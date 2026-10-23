import { Component, computed, effect, OnDestroy, signal, untracked } from '@angular/core';
import { AccountInfo, TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { WalletAccount, WalletStateService } from '../../../core/services/wallet-state.service';
import { TransactionService } from '../../../core/services/transaction.service';
import {
  normalizePubEm,
  resolveAccountSigner,
  sameKey,
  sortAuthorityKeys,
} from '../../../core/services/account-signer';

interface ActionLink { contract: string; action: string; permission: string }

export interface AuthorityKeyDraft {
  key: string;
  weight: number;
}

export interface AuthorityAccountDraft {
  permission: { actor: string; permission: string };
  weight: number;
}

// Reject aliases such as trailing dots so comparisons match chain name identity.
function validName(value: string): boolean {
  return /^(?=.{1,13}$)[a-z1-5.]{1,12}[a-j1-5.]?$/.test(value) && !value.endsWith('.');
}

@Component({
  selector: 'app-permissions',
  standalone: true,
  templateUrl: './permissions.html',
  styleUrl: './permissions.css',
})
export class PermissionsComponent implements OnDestroy {
  readonly info = signal<AccountInfo | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly contract = signal('');
  readonly action = signal('');
  readonly permission = signal('');
  readonly actions = signal<string[]>([]);
  readonly loadedContract = signal('');
  readonly loadingActions = signal(false);
  readonly actionError = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly transactionId = signal('');
  readonly showFullKeys = signal(false);
  readonly copiedKey = signal('');
  readonly vaultKeys = signal<Set<string>>(new Set());
  readonly ethAddresses = signal<Record<string, string>>({});

  // ── Authority Editor (updateauth) state ──
  readonly authEditorOpen = signal(false);
  readonly authIsNew = signal(false);
  readonly authPermName = signal('active');
  readonly authParent = signal('owner');
  readonly authThreshold = signal(1);
  readonly authSigningPerm = signal<'active' | 'owner'>('active');
  readonly authKeys = signal<AuthorityKeyDraft[]>([]);
  readonly authAccounts = signal<AuthorityAccountDraft[]>([]);
  readonly authWaits = signal<{ wait_sec: number; weight: number }[]>([]);
  readonly newKeyInput = signal('');
  readonly newKeyWeight = signal(1);
  readonly newAcctActor = signal('');
  readonly newAcctPerm = signal('active');
  readonly newAcctWeight = signal(1);
  readonly ownerConfirmText = signal('');
  readonly ledgerEthSlot = signal(0);
  readonly discoveringKey = signal<'metamask' | 'ledger_eth' | null>(null);
  readonly authError = signal('');
  readonly authNotice = signal('');
  readonly authTxId = signal('');

  readonly allPermissions = computed(() => this.info()?.permissions ?? []);
  readonly permissions = computed(() => (this.info()?.permissions ?? []).filter(p => p.perm_name !== 'owner'));
  readonly vaultKeyList = computed(() => Array.from(this.vaultKeys()));
  readonly linksAvailable = computed(() => !!this.info()?.permissions.length &&
    this.info()!.permissions.every(p => Array.isArray(p.linked_actions)));
  readonly links = computed<ActionLink[]>(() => (this.info()?.permissions ?? []).flatMap(p =>
    (p.linked_actions ?? []).map(link => ({ contract: link.account, action: link.action, permission: p.perm_name })))
    .sort((a, b) => a.contract.localeCompare(b.contract) || a.action.localeCompare(b.action)));
  readonly currentLink = computed(() => this.links().find(link =>
    link.contract === this.contract().trim() && link.action === this.action()));
  readonly unchanged = computed(() => !!this.currentLink() && this.currentLink()!.permission === this.permission());
  readonly canReview = computed(() => !!this.info() && this.info()!.account_name === this.wallet.selectedAccount()?.name &&
    this.identity === `${this.wallet.selectedAccount()?.chainId}:${this.wallet.selectedAccount()?.name}` &&
    !this.loading() && !this.busy() && !this.loadingActions() &&
    this.wallet.selectedAccount()?.mode === 'full' && this.loadedContract() === this.contract().trim() &&
    this.actions().includes(this.action()) && this.permissions().some(p => p.perm_name === this.permission()) && !this.unchanged());

  readonly is20ByteEthAddress = computed(() => {
    const raw = this.newKeyInput().trim();
    if (!raw) return false;
    const stripped = raw.replace(/^(?:PUB_EM_|0x|0X)/, '');
    return stripped.length === 40 && /^[0-9a-fA-F]{40}$/.test(stripped);
  });

  readonly totalAuthWeight = computed(() => {
    const keySum = this.authKeys().reduce((sum, k) => sum + (Number(k.weight) || 0), 0);
    const acctSum = this.authAccounts().reduce((sum, a) => sum + (Number(a.weight) || 0), 0);
    const waitSum = this.authWaits().reduce((sum, w) => sum + (Number(w.weight) || 0), 0);
    return keySum + acctSum + waitSum;
  });

  readonly ownerConfirmExpected = computed(() => {
    const acct = this.wallet.selectedAccount()?.name ?? '';
    return acct ? `${acct}@owner` : 'owner';
  });

  readonly canReviewAuth = computed(() => {
    const account = this.wallet.selectedAccount();
    if (!account || !this.info() || this.info()!.account_name !== account.name) return false;
    if (this.identity !== `${account.chainId}:${account.name}`) return false;
    if (this.loading() || this.busy() || this.discoveringKey() !== null) return false;
    const perm = this.authPermName().trim();
    const parent = this.authParent().trim();
    if (!validName(perm)) return false;
    if (perm === 'owner') {
      if (parent !== '') return false;
      if (this.ownerConfirmText().trim() !== `${account.name}@owner`) return false;
    } else {
      if (!validName(parent) || parent === perm) return false;
    }
    const threshold = Number(this.authThreshold());
    if (!Number.isInteger(threshold) || threshold < 1) return false;
    if (this.totalAuthWeight() < threshold) return false;
    return true;
  });

  private generation = 0;
  private accountRequest = 0;
  private abiRequest = 0;
  private destroyed = false;

  constructor(public wallet: WalletStateService, private ipc: TauriIpcService, private tx: TransactionService) {
    effect(() => {
      const account = this.wallet.selectedAccount();
      // Watch identity, not background balance updates of the same account.
      const identity = account ? `${account.chainId}:${account.name}` : '';
      untracked(() => this.selectAccount(identity));
    });
  }

  private identity = '';
  private selectAccount(identity: string) {
    if (this.identity === identity) return;
    this.identity = identity;
    this.generation++;
    this.accountRequest++;
    this.abiRequest++;
    this.info.set(null);
    this.contract.set('');
    this.action.set('');
    this.permission.set('');
    this.actions.set([]);
    this.loadedContract.set('');
    this.loadingActions.set(false);
    this.busy.set(false);
    this.error.set('');
    this.actionError.set('');
    this.transactionId.set('');
    this.authEditorOpen.set(false);
    this.authError.set('');
    this.authNotice.set('');
    this.authTxId.set('');
    this.ownerConfirmText.set('');
    void this.refresh();
  }

  ngOnDestroy() { this.destroyed = true; this.generation++; }

  private isCurrent(account: WalletAccount, generation: number): boolean {
    const current = this.wallet.selectedAccount();
    return !this.destroyed && this.generation === generation && current?.chainId === account.chainId && current?.name === account.name;
  }

  async refresh() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    const generation = this.generation;
    const request = ++this.accountRequest;
    this.loading.set(true);
    this.loadError.set('');
    if (account.ledgerIndex === undefined && typeof (this.wallet as any).activeChain === 'function') {
      void this.loadVaultKeys(account.chainId);
    }
    try {
      const info = await this.ipc.getAccount(account.chainId, account.name);
      if (!this.isCurrent(account, generation) || request !== this.accountRequest) return;
      this.info.set(info);
      if (!info.permissions.some(p => p.perm_name === this.permission())) this.permission.set('');
      void this.resolveEthAddressesForInfo(info);
    } catch (error) {
      if (this.isCurrent(account, generation) && request === this.accountRequest) {
        this.info.set(null);
        this.loadError.set(`Could not load permissions. Refresh to try again. ${this.message(error)}`);
      }
    } finally {
      if (this.isCurrent(account, generation) && request === this.accountRequest) this.loading.set(false);
    }
  }

  private async loadVaultKeys(chainId: string) {
    try {
      const keys = await this.ipc.listPublicKeys(chainId);
      this.vaultKeys.set(new Set(keys ?? []));
      for (const k of keys ?? []) {
        if (k.startsWith('PUB_EM_')) {
          void this.ensureEthAddress(k);
        }
      }
    } catch {
      this.vaultKeys.set(new Set());
    }
  }

  private async resolveEthAddressesForInfo(info: AccountInfo) {
    for (const perm of info.permissions ?? []) {
      for (const k of perm.required_auth?.keys ?? []) {
        if (k.key?.startsWith('PUB_EM_')) {
          await this.ensureEthAddress(k.key);
        }
      }
    }
  }

  private async ensureEthAddress(key: string) {
    const norm = normalizePubEm(key);
    if (!norm.startsWith('PUB_EM_')) return;
    if (this.ethAddresses()[norm]) return;
    if (typeof (this.ipc as any).ethAddressFromPublicKey !== 'function') return;
    try {
      const addr = await this.ipc.ethAddressFromPublicKey(norm);
      if (addr) {
        this.ethAddresses.update(map => ({ ...map, [norm]: addr }));
      }
    } catch { /* ignore */ }
  }

  canonicalKey(key: string): string {
    return normalizePubEm(key || '');
  }

  ethAddressFor(key: string): string {
    const norm = normalizePubEm(key || '');
    return this.ethAddresses()[norm] ?? '';
  }

  hasVaultKey(key: string): boolean {
    if (!key) return false;
    const trimmed = key.trim();
    if (this.vaultKeys().has(trimmed)) return true;
    for (const vk of this.vaultKeys()) {
      if (sameKey(vk, trimmed)) return true;
    }
    return false;
  }

  keyTypeBadge(key: string): string {
    if (!key) return 'KEY';
    if (key.startsWith('PUB_EM_')) return 'EM';
    if (key.startsWith('PUB_R1_')) return 'R1';
    if (key.startsWith('PUB_WA_')) return 'WA';
    if (key.startsWith('PUB_K1_') || key.startsWith('EOS') || key.startsWith('FIO')) return 'K1';
    return 'KEY';
  }

  formatKey(key: string): string {
    if (!key) return '';
    const norm = normalizePubEm(key);
    if (this.showFullKeys() || norm.length <= 42) return norm;
    return `${norm.slice(0, 22)}…${norm.slice(-10)}`;
  }

  async copyKey(value: string) {
    if (!value) return;
    const norm = normalizePubEm(value);
    try {
      await navigator.clipboard.writeText(norm);
      this.copiedKey.set(value);
      setTimeout(() => {
        if (this.copiedKey() === value) this.copiedKey.set('');
      }, 1800);
    } catch { /* ignore */ }
  }

  // ── Authority Editor (updateauth) ──

  openEditAuthority(permName: string) {
    const perm = this.allPermissions().find(p => p.perm_name === permName);
    if (!perm) return;
    this.authEditorOpen.set(true);
    this.authIsNew.set(false);
    this.authPermName.set(perm.perm_name);
    this.authParent.set(perm.perm_name === 'owner' ? '' : (perm.parent || 'owner'));
    this.authThreshold.set(perm.required_auth?.threshold ?? 1);
    this.authSigningPerm.set(perm.perm_name === 'owner' ? 'owner' : 'active');
    const normalizedKeys = (perm.required_auth?.keys ?? []).map((k: { key: string; weight: number }) => ({
      key: normalizePubEm(k.key),
      weight: Number(k.weight) || 1,
    }));
    this.authKeys.set(sortAuthorityKeys(normalizedKeys));
    for (const k of normalizedKeys) {
      if (k.key.startsWith('PUB_EM_')) {
        void this.ensureEthAddress(k.key);
      }
    }
    const accounts = [...(perm.required_auth?.accounts ?? [])]
      .map((a: { permission: { actor: string; permission: string }; weight: number }) => ({
        permission: { actor: a.permission.actor, permission: a.permission.permission },
        weight: Number(a.weight) || 1,
      }))
      .sort((a: AuthorityAccountDraft, b: AuthorityAccountDraft) =>
        a.permission.actor.localeCompare(b.permission.actor) ||
        a.permission.permission.localeCompare(b.permission.permission)
      );
    this.authAccounts.set(accounts);
    const waits = [...(perm.required_auth?.waits ?? [])]
      .map((w: { wait_sec: number; weight: number }) => ({
        wait_sec: Math.max(0, Math.floor(Number(w.wait_sec) || 0)),
        weight: Math.max(1, Math.floor(Number(w.weight) || 1)),
      }))
      .sort((a, b) => a.wait_sec - b.wait_sec);
    this.authWaits.set(waits);
    this.newKeyInput.set('');
    this.newKeyWeight.set(1);
    this.ownerConfirmText.set('');
    this.authError.set('');
    this.authNotice.set('');
    this.authTxId.set('');
  }

  openNewPermission() {
    this.authEditorOpen.set(true);
    this.authIsNew.set(true);
    this.authPermName.set('');
    this.authParent.set('active');
    this.authThreshold.set(1);
    this.authSigningPerm.set('active');
    this.authKeys.set([]);
    this.authAccounts.set([]);
    this.authWaits.set([]);
    this.newKeyInput.set('');
    this.newKeyWeight.set(1);
    this.ownerConfirmText.set('');
    this.authError.set('');
    this.authNotice.set('');
    this.authTxId.set('');
  }

  closeAuthEditor() {
    this.authEditorOpen.set(false);
    this.authError.set('');
    this.authNotice.set('');
  }

  async addKeyToAuthority(rawOverride?: string) {
    this.authError.set('');
    this.authNotice.set('');
    const raw = (rawOverride ?? this.newKeyInput()).trim();
    if (!raw) {
      this.authError.set('Enter a public key (PUB_EM_..., PUB_K1_..., EOS..., or 33/65-byte 0x secp256k1 pubkey hex).');
      return;
    }

    const stripped = raw.replace(/^(?:PUB_EM_|0x|0X)/, '');
    if (stripped.length === 40 && /^[0-9a-fA-F]{40}$/.test(stripped)) {
      this.authError.set(
        'An Ethereum address (20 bytes) is a one-way Keccak-256 hash and cannot be converted directly to a PUB_EM_ public key. Use "From MetaMask" or "From Ledger ETH" below to derive the full 33-byte PUB_EM_ key.'
      );
      return;
    }

    const weight = Math.max(1, Math.floor(Number(this.newKeyWeight()) || 1));
    let canonical = raw;

    try {
      if (
        raw.startsWith('PUB_EM_') ||
        raw.startsWith('0x') ||
        raw.startsWith('0X') ||
        ((raw.length === 66 || raw.length === 130) && /^[0-9a-fA-F]+$/.test(raw))
      ) {
        if (typeof (this.ipc as any).normalizeEmPublicKey === 'function') {
          canonical = await this.ipc.normalizeEmPublicKey(raw);
        } else {
          const hexPart = raw.replace(/^(?:PUB_EM_|0x|0X)/, '');
          canonical = normalizePubEm(`PUB_EM_${hexPart}`);
        }
        void this.ensureEthAddress(canonical);
      } else if (
        raw.startsWith('EOS') ||
        raw.startsWith('PUB_K1_') ||
        raw.startsWith('PUB_R1_') ||
        raw.startsWith('PUB_WA_') ||
        raw.startsWith('FIO')
      ) {
        if (raw.length < 48) {
          throw new Error('Public key appears truncated or invalid.');
        }
        canonical = raw;
      } else {
        throw new Error(
          'Unrecognized public key format. Expected PUB_EM_..., EOS..., PUB_K1_..., or 33/65-byte secp256k1 public key hex.'
        );
      }
    } catch (err) {
      this.authError.set(this.message(err));
      return;
    }

    const existingIdx = this.authKeys().findIndex(k => sameKey(k.key, canonical));
    let next: AuthorityKeyDraft[];
    if (existingIdx >= 0) {
      next = this.authKeys().map((item, idx) =>
        idx === existingIdx ? { key: canonical, weight } : item
      );
      this.authNotice.set(`Updated weight for ${this.formatKey(canonical)} to +${weight}.`);
    } else {
      next = [...this.authKeys(), { key: canonical, weight }];
    }
    this.authKeys.set(sortAuthorityKeys(next));
    if (!rawOverride) {
      this.newKeyInput.set('');
    }
  }

  removeKeyFromAuthority(key: string) {
    this.authKeys.set(this.authKeys().filter(k => !sameKey(k.key, key)));
  }

  updateKeyWeight(key: string, value: number) {
    const weight = Math.max(1, Math.floor(Number(value) || 1));
    this.authKeys.set(
      sortAuthorityKeys(
        this.authKeys().map(k => (sameKey(k.key, key) ? { ...k, weight } : k))
      )
    );
  }

  async discoverFromMetaMask() {
    if (this.discoveringKey()) return;
    this.authError.set('');
    this.authNotice.set('');
    const expectedAddr = this.is20ByteEthAddress()
      ? '0x' + this.newKeyInput().trim().replace(/^(?:PUB_EM_|0x|0X)/, '').toLowerCase()
      : '';
    this.discoveringKey.set('metamask');
    try {
      const res = await this.ipc.metamaskDiscoverKey();
      this.ethAddresses.update(map => ({ ...map, [res.public_key]: res.eth_address }));
      await this.addKeyToAuthority(res.public_key);
      this.newKeyInput.set('');
      if (expectedAddr && res.eth_address.toLowerCase() !== expectedAddr) {
        this.authNotice.set(
          `Recovered ${res.public_key} (${res.eth_address}) from MetaMask — note that this differs from ${expectedAddr}.`
        );
      } else {
        this.authNotice.set(`Recovered ${res.eth_address} → ${this.formatKey(res.public_key)} from MetaMask.`);
      }
    } catch (err) {
      this.authError.set(`MetaMask key discovery failed: ${this.message(err)}`);
    } finally {
      this.discoveringKey.set(null);
    }
  }

  async discoverFromLedgerEth() {
    if (this.discoveringKey()) return;
    this.authError.set('');
    this.authNotice.set('');
    const slot = Math.max(0, Math.floor(Number(this.ledgerEthSlot()) || 0));
    this.discoveringKey.set('ledger_eth');
    try {
      const res = await this.ipc.ledgerGetEthPublicKey(0, slot, false);
      this.ethAddresses.update(map => ({ ...map, [res.public_key]: res.eth_address }));
      await this.addKeyToAuthority(res.public_key);
      this.newKeyInput.set('');
      this.authNotice.set(`Derived Ledger ETH slot #${slot} (${res.eth_address}) → ${this.formatKey(res.public_key)}.`);
    } catch (err) {
      this.authError.set(`Ledger Ethereum app discovery failed: ${this.message(err)}`);
    } finally {
      this.discoveringKey.set(null);
    }
  }

  addAccountToAuthority() {
    this.authError.set('');
    const actor = this.newAcctActor().trim();
    const permission = this.newAcctPerm().trim();
    const weight = Math.max(1, Math.floor(Number(this.newAcctWeight()) || 1));
    if (!validName(actor) || !validName(permission)) {
      this.authError.set('Enter valid Antelope account and permission names (a–z, 1–5, dots, up to 13 chars).');
      return;
    }
    const filtered = this.authAccounts().filter(
      a => !(a.permission.actor === actor && a.permission.permission === permission)
    );
    const next = [...filtered, { permission: { actor, permission }, weight }].sort(
      (a, b) =>
        a.permission.actor.localeCompare(b.permission.actor) ||
        a.permission.permission.localeCompare(b.permission.permission)
    );
    this.authAccounts.set(next);
    this.newAcctActor.set('');
  }

  removeAccountFromAuthority(actor: string, permission: string) {
    this.authAccounts.set(
      this.authAccounts().filter(
        a => !(a.permission.actor === actor && a.permission.permission === permission)
      )
    );
  }

  async reviewAuthorityUpdate() {
    if (!this.canReviewAuth()) return;
    const account = this.wallet.selectedAccount()!;
    const generation = this.generation;
    const permName = this.authPermName().trim();
    const parent = permName === 'owner' ? '' : this.authParent().trim();
    const threshold = Math.max(1, Math.floor(Number(this.authThreshold()) || 1));
    const sortedKeys = sortAuthorityKeys(
      this.authKeys().map(k => ({
        key: normalizePubEm(k.key),
        weight: Math.max(1, Math.floor(Number(k.weight) || 1)),
      }))
    );
    const sortedAccounts = [...this.authAccounts()]
      .map(a => ({
        permission: { actor: a.permission.actor.trim(), permission: a.permission.permission.trim() },
        weight: Math.max(1, Math.floor(Number(a.weight) || 1)),
      }))
      .sort(
        (a, b) =>
          a.permission.actor.localeCompare(b.permission.actor) ||
          a.permission.permission.localeCompare(b.permission.permission)
      );

    this.busy.set(true);
    this.authError.set('');
    this.authNotice.set('');
    this.authTxId.set('');
    try {
      const latestInfo = await this.ipc.getAccount(account.chainId, account.name);
      if (!this.isCurrent(account, generation)) return;
      this.info.set(latestInfo);

      let signingPerm: 'active' | 'owner' = permName === 'owner' ? 'owner' : this.authSigningPerm();
      let signer: { publicKey: string; ledgerIndex?: number };
      try {
        signer = await resolveAccountSigner(this.ipc, { ...account, info: latestInfo }, signingPerm);
      } catch (primaryErr) {
        if (signingPerm === 'active') {
          signer = await resolveAccountSigner(this.ipc, { ...account, info: latestInfo }, 'owner');
          signingPerm = 'owner';
        } else {
          throw primaryErr;
        }
      }
      if (!this.isCurrent(account, generation)) return;

      const systemContract = this.wallet.systemAccount?.('updateauth') ?? 'eosio';
      const authPayload: Record<string, unknown> = {
        threshold,
        keys: sortedKeys,
        accounts: sortedAccounts,
      };
      if (systemContract !== 'sysio') {
        authPayload['waits'] = this.authWaits();
      }

      const result = await this.tx.confirm({
        chainId: account.chainId,
        ...signer,
        title: `Update Authority (${account.name}@${permName})`,
        actions: [{
          account: systemContract,
          name: 'updateauth',
          authorization: [{ actor: account.name, permission: signingPerm }],
          data: {
            account: account.name,
            permission: permName,
            parent,
            auth: authPayload,
          },
        }],
      });
      if (!this.isCurrent(account, generation)) return;
      if (result?.transaction_id) {
        this.authTxId.set(result.transaction_id);
        this.ownerConfirmText.set('');
        await this.refresh();
      }
    } catch (error) {
      if (this.isCurrent(account, generation)) {
        this.authError.set(this.message(error));
      }
    } finally {
      if (this.isCurrent(account, generation)) {
        this.busy.set(false);
      }
    }
  }

  // ── Action Linker (linkauth) ──

  setContract(value: string) {
    this.abiRequest++;
    this.contract.set(value);
    this.actions.set([]);
    this.loadedContract.set('');
    this.action.set('');
    this.loadingActions.set(false);
    this.actionError.set('');
    this.clearOutcome();
  }

  clearOutcome() { this.error.set(''); this.transactionId.set(''); }

  async loadActions(preselect = '') {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    const contract = this.contract().trim();
    if (!validName(contract)) {
      this.actionError.set('Enter a valid contract account: a–z, 1–5 or dots, up to 13 characters. The 13th character must be a–j or 1–5.');
      return;
    }
    const generation = this.generation;
    const request = ++this.abiRequest;
    this.loadingActions.set(true);
    this.actions.set([]);
    this.action.set('');
    this.loadedContract.set('');
    this.actionError.set('');
    try {
      const response = await this.ipc.getAbi(account.chainId, contract);
      if (!this.isCurrent(account, generation) || request !== this.abiRequest) return;
      const actions = this.readActions(response);
      if (!actions.length) throw new Error('This contract ABI has no actions. Check the contract account.');
      this.actions.set(actions);
      this.loadedContract.set(contract);
      if (actions.includes(preselect)) this.action.set(preselect);
    } catch (error) {
      if (this.isCurrent(account, generation) && request === this.abiRequest) {
        this.actionError.set(`Could not load actions. ${this.message(error)}`);
      }
    } finally {
      if (this.isCurrent(account, generation) && request === this.abiRequest) this.loadingActions.set(false);
    }
  }

  editLink(link: ActionLink) {
    if (this.busy()) return;
    this.setContract(link.contract);
    this.permission.set(link.permission);
    void this.loadActions(link.action);
  }

  async reviewLink() {
    if (!this.canReview()) return;
    const account = this.wallet.selectedAccount()!;
    const generation = this.generation;
    const code = this.contract().trim();
    const action = this.action();
    const requirement = this.permission();
    this.busy.set(true);
    this.clearOutcome();
    try {
      // Recheck live inputs before opening the signing window. The backend then
      // serializes eosio::linkauth locally and owns confirmation and broadcast.
      const [info, abi] = await Promise.all([
        this.ipc.getAccount(account.chainId, account.name),
        this.ipc.getAbi(account.chainId, code),
      ]);
      if (!this.isCurrent(account, generation)) return;
      this.info.set(info);
      if (!validName(code) || !validName(action) || !validName(requirement) || requirement === 'owner' ||
          !info.permissions.some(p => p.perm_name === requirement)) {
        throw new Error('The selected permission is no longer available. Refresh and select a permission.');
      }
      if (!this.readActions(abi).includes(action)) throw new Error('This action is no longer in the contract ABI. Load actions again.');
      if (info.permissions.some(p => p.perm_name === requirement &&
          p.linked_actions?.some(link => link.account === code && link.action === action))) {
        throw new Error('This action is already linked to the selected permission.');
      }
      const signer = await resolveAccountSigner(this.ipc, account, 'active');
      if (!this.isCurrent(account, generation)) return;
      const result = await this.tx.confirm({
        chainId: account.chainId,
        ...signer,
        title: 'Link Action Permission',
        actions: [{
          account: this.wallet.systemAccount?.('linkauth') ?? 'eosio', name: 'linkauth',
          authorization: [{ actor: account.name, permission: 'active' }],
          data: { account: account.name, code, type: action, requirement },
        }],
      });
      if (!this.isCurrent(account, generation)) return;
      if (result?.transaction_id) {
        this.transactionId.set(result.transaction_id);
        await this.refresh();
      }
    } catch (error) {
      if (this.isCurrent(account, generation)) this.error.set(this.message(error));
    } finally {
      if (this.isCurrent(account, generation)) this.busy.set(false);
    }
  }

  private readActions(response: any): string[] {
    const actions = response?.abi?.actions ?? response?.actions;
    return Array.isArray(actions) ? [...new Set<string>(actions.map((a: any) => a?.name)
      .filter((name: unknown): name is string => typeof name === 'string' && validName(name)))].sort() : [];
  }

  private message(error: unknown) { return error instanceof Error ? error.message : String(error); }
}
