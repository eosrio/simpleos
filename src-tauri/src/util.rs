//! Small shared utilities.

/// Safely truncate a string to at most `n` characters for display/logging.
///
/// SEC-010/011/013/044: never byte-index attacker-controlled strings — a short
/// string or a multibyte char straddling the byte offset would panic, and with
/// `panic="abort"` that aborts the whole process. This follows the existing
/// `.min(len)` idiom (keystore/store.rs, antelope/discovery.rs) but is also
/// char-boundary safe (operates on `char_indices`, never on raw byte offsets).
pub fn short_prefix(s: &str, n: usize) -> &str {
    match s.char_indices().nth(n) {
        Some((byte_idx, _)) => &s[..byte_idx],
        None => s,
    }
}

/// Safely take the last `n` characters of a string for display/logging.
///
/// SEC-011: char-boundary-safe replacement for `&s[s.len()-n..]`.
pub fn short_suffix(s: &str, n: usize) -> &str {
    let total = s.chars().count();
    if total <= n {
        return s;
    }
    match s.char_indices().nth(total - n) {
        Some((byte_idx, _)) => &s[byte_idx..],
        None => s,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_prefix_handles_short_and_multibyte() {
        assert_eq!(short_prefix("abcdef", 3), "abc");
        assert_eq!(short_prefix("ab", 8), "ab"); // shorter than n
        assert_eq!(short_prefix("", 8), "");
        // multibyte char straddling the byte offset must not panic
        assert_eq!(short_prefix("aé", 8), "aé");
        assert_eq!(short_prefix("éééé", 2), "éé");
    }

    #[test]
    fn short_suffix_handles_short_and_multibyte() {
        assert_eq!(short_suffix("abcdef", 2), "ef");
        assert_eq!(short_suffix("ab", 6), "ab");
        assert_eq!(short_suffix("", 6), "");
        assert_eq!(short_suffix("éééé", 2), "éé");
    }
}
