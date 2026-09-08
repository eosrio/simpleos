//! Temporary review probes. Assertions confirm current defects, not desired behavior.
use simpleos_lib::{antelope::{serialize, signing}, error::Error, keystore::{store::{KeyStore, MemoryKeyStore, FileKeyStore}, wallet::WalletService}};
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

const PASS: &str = "review-only-passphrase";
const NEW_PASS: &str = "review-only-new-passphrase";
struct FaultStore { inner: Arc<MemoryKeyStore>, writes: Arc<AtomicUsize>, fail_at: Arc<AtomicUsize> }
impl KeyStore for FaultStore {
    fn store_key(&self,c:&str,k:&str,v:&[u8])->Result<(),Error>{
        let n=self.writes.fetch_add(1,Ordering::SeqCst)+1;
        if n==self.fail_at.load(Ordering::SeqCst){return Err(Error::Io(std::io::Error::other("review injected write failure")));}
        self.inner.store_key(c,k,v)
    }
    fn load_key(&self,c:&str,k:&str)->Result<Vec<u8>,Error>{self.inner.load_key(c,k)}
    fn delete_key(&self,c:&str,k:&str)->Result<(),Error>{self.inner.delete_key(c,k)}
    fn list_keys(&self,c:&str)->Result<Vec<String>,Error>{self.inner.list_keys(c)}
    fn clear_index(&self,c:&str)->Result<(),Error>{self.inner.clear_index(c)}
}

#[test]
fn interrupted_passphrase_change_strands_first_key() {
    let writes=Arc::new(AtomicUsize::new(0)); let fail_at=Arc::new(AtomicUsize::new(usize::MAX));
    let w=WalletService::new(Box::new(FaultStore{inner:Arc::new(MemoryKeyStore::new()),writes:writes.clone(),fail_at:fail_at.clone()}),vec!["review-chain".into()]);
    let (a,ap)=signing::generate_keypair().unwrap(); let (b,bp)=signing::generate_keypair().unwrap();
    w.import_keys(&[(&a,"review-chain"),(&b,"review-chain")],PASS).unwrap();
    writes.store(0,Ordering::SeqCst);fail_at.store(2,Ordering::SeqCst);
    assert!(w.change_passphrase(PASS,NEW_PASS).is_err());
    fail_at.store(usize::MAX,Ordering::SeqCst);w.lock();
    assert!(w.unlock(NEW_PASS).is_err()); w.unlock(PASS).unwrap();
    assert!(w.decrypt_key("review-chain",&ap).is_err());
    assert!(w.decrypt_key("review-chain",&bp).is_ok());
    assert!(w.change_passphrase(PASS,NEW_PASS).is_err());
    println!("CONFIRMED: second write failure strands the first key; old password unlocks but cannot decrypt it; new password cannot unlock; retry fails");
}

#[test]
fn missing_token_accepts_an_unrelated_passphrase() {
    let w=WalletService::new(Box::new(MemoryKeyStore::new()),vec!["review-chain".into()]);
    let (a,ap)=signing::generate_keypair().unwrap();w.import_key(&a,"review-chain",PASS).unwrap();
    w.remove_key("__vault__","__verify__").unwrap();w.lock();
    w.unlock("unrelated-review-passphrase").unwrap();
    assert!(w.decrypt_key("review-chain",&ap).is_err());w.lock();
    assert!(w.unlock(PASS).is_err());
    println!("CONFIRMED: missing verification token accepts unrelated password and replaces the vault credential");
}

#[test]
fn file_store_allows_parent_traversal_inside_review_sandbox() {
    let root=std::env::temp_dir().join(format!("simpleos-readiness-path-{}",std::process::id()));
    let s=FileKeyStore::new(root.clone());
    s.store_key("../escaped","review-key",b"nonsecret review bytes").unwrap();
    assert!(root.join("escaped/index.json").exists());
    println!("CONFIRMED: ../escaped writes outside the keys directory, within {}",root.display());
}

#[test]
fn file_store_panics_on_multibyte_chain_id() {
    let s=FileKeyStore::new(std::env::temp_dir().join("simpleos-readiness-unicode"));
    let result=std::panic::catch_unwind(||s.list_keys("aaaaaaaaaaaaaaaé"));
    assert!(result.is_err());
    println!("CONFIRMED: 16-byte prefix splits UTF-8 and panics");
}

#[test]
fn native_transfer_changes_displayed_recipient() {
    let displayed="abcdefghijklz";
    let data=serialize::serialize_transfer("alice",displayed,"1.0000 EOS","").unwrap();
    let actual=serialize::u64_to_name(u64::from_le_bytes(data[8..16].try_into().unwrap()));
    assert_ne!(actual,displayed); assert_eq!(actual,"abcdefghijklj");
    assert_eq!(serialize::name_to_u64("aliceaaaaaaaaa").unwrap(),serialize::name_to_u64("aliceaaaaaaaa").unwrap());
    println!("CONFIRMED: displayed recipient {displayed} is encoded as {actual}; overlong names are silently truncated");
}

#[test]
fn configured_keyring_has_no_cross_entry_persistence() {
    let label=format!("simpleos-readiness-probe-{}",std::process::id());
    let first=keyring::Entry::new("simpleos-readiness-review",&label).unwrap();
    first.set_password("nonsecret probe").unwrap();
    assert_eq!(first.get_password().unwrap(),"nonsecret probe");
    let second=keyring::Entry::new("simpleos-readiness-review",&label).unwrap();
    assert!(second.get_password().is_err()); first.delete_credential().unwrap();
    println!("CONFIRMED: configured keyring only retains data on the original Entry; startup necessarily selects file fallback");
}
