//! PowerUp resource model: state queries, cost estimation, and action building.
//!
//! The PowerUp system allows users to rent CPU and NET resources for a fixed period
//! (typically 1 day on Vaulta, 30 days on some chains) by paying a fee.
//!
//! Pricing uses an integral-based model where fee increases quadratically with utilization:
//!   fee(u1 → u2) = min_price * (u2 - u1) + ((max_price - min_price) / exponent) * (u2^exp - u1^exp)
//!
//! Key constants:
//! - powerup_frac = 10^15 (100% = 1_000_000_000_000_000)
//! - Resources expire after powerup_days and are reclaimed by the system

use crate::antelope::provider::ProviderManager;
use crate::error::Error;
use serde::{Deserialize, Serialize};

/// 10^15 = 100% fraction for powerup calculations.
const _POWERUP_FRAC: f64 = 1_000_000_000_000_000.0;

// ── State Types ──

/// The on-chain PowerUp market state (from `powup.state` table).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerUpState {
    pub version: u8,
    pub net: PowerUpResourceState,
    pub cpu: PowerUpResourceState,
    pub powerup_days: u32,
    pub min_powerup_fee: String,
}

/// Per-resource (NET or CPU) market state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerUpResourceState {
    pub version: u8,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub weight: i64,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub weight_ratio: i64,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub assumed_stake_weight: i64,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub initial_weight_ratio: i64,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub target_weight_ratio: i64,
    pub initial_timestamp: String,
    pub target_timestamp: String,
    #[serde(deserialize_with = "de_flexible_f64")]
    pub exponent: f64,
    pub decay_secs: u32,
    pub min_price: String,
    pub max_price: String,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub utilization: i64,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub adjusted_utilization: i64,
    pub utilization_timestamp: String,
}

/// Active powerup order for an account.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerUpOrder {
    pub version: u8,
    pub id: u64,
    pub owner: String,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub net_weight: i64,
    #[serde(deserialize_with = "de_flexible_i64")]
    pub cpu_weight: i64,
    pub expires: String,
}

/// Cost estimate for a powerup request.
#[derive(Debug, Clone, Serialize)]
pub struct PowerUpEstimate {
    /// Estimated fee in the system token (e.g., "0.0123 EOS").
    pub fee: String,
    /// Fee as raw amount (in smallest unit).
    pub fee_amount: i64,
    /// NET weight that would be allocated.
    pub net_weight: i64,
    /// CPU weight that would be allocated.
    pub cpu_weight: i64,
    /// Current CPU utilization percentage.
    pub cpu_utilization_pct: f64,
    /// Current NET utilization percentage.
    pub net_utilization_pct: f64,
    /// How many days the powerup lasts.
    pub powerup_days: u32,
    /// The fee token symbol.
    pub fee_symbol: String,
}

/// Summary of account's resource state for the UI.
#[derive(Debug, Clone, Serialize)]
pub struct ResourceSummary {
    pub state: PowerUpState,
    pub active_orders: Vec<PowerUpOrder>,
    pub cpu_utilization_pct: f64,
    pub net_utilization_pct: f64,
}

// ── Queries ──

/// Fetch the PowerUp market state from the chain.
pub async fn get_powerup_state(pm: &mut ProviderManager) -> Result<PowerUpState, Error> {
    let result = pm
        .rpc_call(
            "/v1/chain/get_table_rows",
            &serde_json::json!({
                "code": "eosio",
                "table": "powup.state",
                "scope": "",
                "json": true,
                "limit": 1,
            }),
            |json| Ok(json),
        )
        .await?;

    let rows = result
        .get("rows")
        .and_then(|r| r.as_array())
        .ok_or_else(|| Error::Rpc("No rows in powup.state".into()))?;

    if rows.is_empty() {
        return Err(Error::Rpc("PowerUp not configured on this chain".into()));
    }

    serde_json::from_value(rows[0].clone())
        .map_err(|e| Error::Rpc(format!("Failed to parse powup.state: {}", e)))
}

/// Fetch active powerup orders for an account.
pub async fn get_powerup_orders(
    pm: &mut ProviderManager,
    account: &str,
) -> Result<Vec<PowerUpOrder>, Error> {
    let result = pm
        .rpc_call(
            "/v1/chain/get_table_rows",
            &serde_json::json!({
                "code": "eosio",
                "table": "powup.order",
                "scope": "",
                "json": true,
                "limit": 100,
                "index_position": "2",
                "key_type": "name",
                "lower_bound": account,
                "upper_bound": account,
            }),
            |json| Ok(json),
        )
        .await?;

    let empty = vec![];
    let rows = result
        .get("rows")
        .and_then(|r| r.as_array())
        .unwrap_or(&empty);

    let orders: Vec<PowerUpOrder> = rows
        .iter()
        .filter_map(|r| serde_json::from_value(r.clone()).ok())
        .collect();

    Ok(orders)
}

/// Get a full resource summary: state + active orders.
pub async fn get_resource_summary(
    pm: &mut ProviderManager,
    account: &str,
) -> Result<ResourceSummary, Error> {
    let state = get_powerup_state(pm).await?;
    let active_orders = get_powerup_orders(pm, account).await?;

    let cpu_pct = if state.cpu.weight > 0 {
        (state.cpu.utilization as f64 / state.cpu.weight as f64) * 100.0
    } else {
        0.0
    };

    let net_pct = if state.net.weight > 0 {
        (state.net.utilization as f64 / state.net.weight as f64) * 100.0
    } else {
        0.0
    };

    Ok(ResourceSummary {
        state,
        active_orders,
        cpu_utilization_pct: cpu_pct,
        net_utilization_pct: net_pct,
    })
}

// ── Cost Estimation ──

/// Estimate the cost of a powerup request.
///
/// `cpu_us` - Desired CPU microseconds (will be converted to weight fraction).
/// `net_bytes` - Desired NET bytes (optional, 0 = skip).
///
/// For simplicity, we estimate based on a fraction of total weight.
/// The `cpu_frac` / `net_frac` are what the user would pass to the `powerup` action.
pub fn estimate_powerup_cost(
    state: &PowerUpState,
    cpu_frac: f64,
    net_frac: f64,
) -> Result<PowerUpEstimate, Error> {
    let precision = parse_precision(&state.min_powerup_fee);
    let symbol = parse_symbol(&state.min_powerup_fee);
    let multiplier = 10_f64.powi(precision as i32);

    // CPU fee
    let cpu_fee = if cpu_frac > 0.0 {
        calculate_resource_fee(&state.cpu, cpu_frac)?
    } else {
        0.0
    };

    // NET fee
    let net_fee = if net_frac > 0.0 {
        calculate_resource_fee(&state.net, net_frac)?
    } else {
        0.0
    };

    let total_fee = cpu_fee + net_fee;
    let fee_amount = (total_fee * multiplier).ceil() as i64;

    // Ensure minimum fee
    let min_fee_amount = parse_amount(&state.min_powerup_fee);
    let fee_amount = fee_amount.max(min_fee_amount);

    let fee_str = format!(
        "{:.prec$} {}",
        fee_amount as f64 / multiplier,
        symbol,
        prec = precision as usize
    );

    let cpu_weight = (cpu_frac * state.cpu.weight as f64) as i64;
    let net_weight = (net_frac * state.net.weight as f64) as i64;

    let cpu_pct = if state.cpu.weight > 0 {
        (state.cpu.utilization as f64 / state.cpu.weight as f64) * 100.0
    } else {
        0.0
    };

    let net_pct = if state.net.weight > 0 {
        (state.net.utilization as f64 / state.net.weight as f64) * 100.0
    } else {
        0.0
    };

    Ok(PowerUpEstimate {
        fee: fee_str,
        fee_amount,
        net_weight,
        cpu_weight,
        cpu_utilization_pct: cpu_pct,
        net_utilization_pct: net_pct,
        powerup_days: state.powerup_days,
        fee_symbol: symbol,
    })
}

/// Calculate the fee for a single resource (CPU or NET) given a fraction.
fn calculate_resource_fee(
    res: &PowerUpResourceState,
    frac: f64,
) -> Result<f64, Error> {
    if res.weight <= 0 {
        return Ok(0.0);
    }

    let min_price = parse_amount_f64(&res.min_price);
    let max_price = parse_amount_f64(&res.max_price);
    let exponent = res.exponent;

    let amount = (frac * res.weight as f64) as i64;
    let new_util = res.utilization + amount;

    if new_util > res.weight {
        return Err(Error::Rpc("Requested amount exceeds available resources".into()));
    }

    let adj_util = res.adjusted_utilization.max(res.utilization);

    // Phase 1: from utilization to adjusted_utilization (flat price)
    let flat_amount = if res.utilization < adj_util {
        let flat_end = (res.utilization + amount).min(adj_util);
        flat_end - res.utilization
    } else {
        0
    };

    let flat_price = if adj_util > 0 && res.weight > 0 {
        let u = adj_util as f64 / res.weight as f64;
        min_price + (max_price - min_price) * u.powf(exponent - 1.0)
    } else {
        min_price
    };

    let flat_fee = flat_price * (flat_amount as f64 / res.weight as f64);

    // Phase 2: from adjusted_utilization to new level (integral pricing)
    let integral_amount = amount - flat_amount;
    let integral_fee = if integral_amount > 0 && res.weight > 0 {
        let u1 = adj_util.max(res.utilization) as f64 / res.weight as f64;
        let u2 = (adj_util.max(res.utilization) + integral_amount) as f64 / res.weight as f64;

        let price_range = max_price - min_price;
        let integral = if exponent == 1.0 {
            price_range * (u2 - u1)
        } else {
            (price_range / exponent) * (u2.powf(exponent) - u1.powf(exponent))
        };

        min_price * (u2 - u1) + integral
    } else {
        0.0
    };

    Ok(flat_fee + integral_fee)
}

// ── Action Building ──

/// Build the powerup action data as JSON (for use with sign_and_push).
pub fn build_powerup_action(
    payer: &str,
    receiver: &str,
    days: u32,
    net_frac: i64,
    cpu_frac: i64,
    max_payment: &str,
) -> serde_json::Value {
    serde_json::json!({
        "account": "eosio",
        "name": "powerup",
        "authorization": [{ "actor": payer, "permission": "active" }],
        "data": {
            "payer": payer,
            "receiver": receiver,
            "days": days,
            "net_frac": net_frac,
            "cpu_frac": cpu_frac,
            "max_payment": max_payment,
        }
    })
}

// ── Parsing Helpers ──

fn parse_amount(asset_str: &str) -> i64 {
    let parts: Vec<&str> = asset_str.trim().split_whitespace().collect();
    if parts.is_empty() {
        return 0;
    }
    let amount_str = parts[0];
    let _precision = amount_str.find('.').map(|p| amount_str.len() - p - 1).unwrap_or(0);
    let cleaned = amount_str.replace('.', "");
    cleaned.parse::<i64>().unwrap_or(0)
}

fn parse_amount_f64(asset_str: &str) -> f64 {
    let parts: Vec<&str> = asset_str.trim().split_whitespace().collect();
    if parts.is_empty() {
        return 0.0;
    }
    parts[0].parse::<f64>().unwrap_or(0.0)
}

fn parse_precision(asset_str: &str) -> u8 {
    let parts: Vec<&str> = asset_str.trim().split_whitespace().collect();
    if parts.is_empty() {
        return 4;
    }
    parts[0]
        .find('.')
        .map(|p| (parts[0].len() - p - 1) as u8)
        .unwrap_or(4)
}

fn parse_symbol(asset_str: &str) -> String {
    let parts: Vec<&str> = asset_str.trim().split_whitespace().collect();
    if parts.len() < 2 {
        return "EOS".to_string();
    }
    parts[1].to_string()
}

// ── Flexible deserializers ──

fn de_flexible_i64<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;

    struct V;
    impl<'de> de::Visitor<'de> for V {
        type Value = i64;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("i64 or string")
        }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<i64, E> { Ok(v) }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<i64, E> { Ok(v as i64) }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<i64, E> {
            v.parse().map_err(de::Error::custom)
        }
    }
    deserializer.deserialize_any(V)
}

fn de_flexible_f64<'de, D>(deserializer: D) -> Result<f64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;

    struct V;
    impl<'de> de::Visitor<'de> for V {
        type Value = f64;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("f64 or string")
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<f64, E> { Ok(v) }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<f64, E> { Ok(v as f64) }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<f64, E> { Ok(v as f64) }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<f64, E> {
            v.parse().map_err(de::Error::custom)
        }
    }
    deserializer.deserialize_any(V)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_asset_amounts() {
        assert_eq!(parse_amount("2500.0000 EOS"), 25000000);
        assert_eq!(parse_amount("0.0001 EOS"), 1);
        assert_eq!(parse_amount("75000.0000 EOS"), 750000000);
        assert_eq!(parse_amount_f64("2500.0000 EOS"), 2500.0);
    }

    #[test]
    fn parse_asset_precision_and_symbol() {
        assert_eq!(parse_precision("2500.0000 EOS"), 4);
        assert_eq!(parse_precision("1.00000000 WAX"), 8);
        assert_eq!(parse_symbol("2500.0000 EOS"), "EOS");
        assert_eq!(parse_symbol("1.0000 A"), "A");
    }

    #[test]
    fn estimate_cost_zero_frac() {
        let state = mock_state();
        let est = estimate_powerup_cost(&state, 0.0, 0.0).unwrap();
        // Minimum fee should apply
        assert!(est.fee_amount >= 1); // min_powerup_fee = 0.0001
    }

    #[test]
    fn estimate_cost_small_frac() {
        let state = mock_state();
        // Request 0.01% CPU
        let est = estimate_powerup_cost(&state, 0.0001, 0.0).unwrap();
        assert!(est.cpu_weight > 0);
        assert!(est.fee_amount > 0);
        assert!(est.fee.contains("EOS"));
    }

    #[test]
    fn estimate_cost_exceeds_capacity_fails() {
        let state = mock_state();
        // Request 200% — should fail
        let result = estimate_powerup_cost(&state, 2.0, 0.0);
        assert!(result.is_err());
    }

    fn mock_state() -> PowerUpState {
        PowerUpState {
            version: 0,
            net: PowerUpResourceState {
                version: 0,
                weight: 95454029146410,
                weight_ratio: 10000000000000,
                assumed_stake_weight: 964182112590,
                initial_weight_ratio: 1000000000000000,
                target_weight_ratio: 10000000000000,
                initial_timestamp: "2021-02-24T03:31:31".into(),
                target_timestamp: "2021-04-08T08:08:08".into(),
                exponent: 2.0,
                decay_secs: 86400,
                min_price: "2500.0000 EOS".into(),
                max_price: "75000.0000 EOS".into(),
                utilization: 14860872199,
                adjusted_utilization: 21998774610,
                utilization_timestamp: "2026-04-04T01:05:18".into(),
            },
            cpu: PowerUpResourceState {
                version: 0,
                weight: 381816116585640,
                weight_ratio: 10000000000000,
                assumed_stake_weight: 3856728450360,
                initial_weight_ratio: 1000000000000000,
                target_weight_ratio: 10000000000000,
                initial_timestamp: "2021-02-24T03:31:31".into(),
                target_timestamp: "2021-04-08T08:08:08".into(),
                exponent: 2.0,
                decay_secs: 86400,
                min_price: "2500.0000 EOS".into(),
                max_price: "75000.0000 EOS".into(),
                utilization: 17413493555790,
                adjusted_utilization: 17612875187990,
                utilization_timestamp: "2026-04-04T01:05:18".into(),
            },
            powerup_days: 1,
            min_powerup_fee: "0.0001 EOS".into(),
        }
    }
}
