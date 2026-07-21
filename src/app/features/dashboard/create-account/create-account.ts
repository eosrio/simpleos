import { Component, computed, signal } from '@angular/core';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { WalletStateService } from '../../../core/services/wallet-state.service';

/** A locally-kept record of an account this wallet created. */
interface CreatedRecord {
  name: string;
  chainId: string;
  ownerKey: string;
  activeKey: string;
  createdAt: number;
}

@Component({
  selector: 'app-create-account',
  standalone: true,
  template: `
    <div class="create-layout">
      <!-- ── Create form ── -->
      <div class="create-form">
        <h2>Create Account</h2>
        <p class="lede">
          Create a new account on <strong>{{ wallet.activeChain().name }}</strong>.
          <span class="payer">{{ creator() }}</span> pays for RAM and the CPU / NET stake.
        </p>

        @if (!wallet.canSign()) {
          <div class="banner error">
            The selected account is watch-only — it can't sign the creation transaction.
            Switch to an account whose keys you hold.
          </div>
        }

        <!-- New account name -->
        <div class="form-group">
          <label>New account name</label>
          <input class="form-input mono" type="text" spellcheck="false" autocapitalize="off"
                 placeholder="12 chars, a–z and 1–5"
                 maxlength="13"
                 [class.input-valid]="nameValid() === true"
                 [class.input-invalid]="nameValid() === false"
                 [value]="newName()"
                 (input)="onNameInput($any($event.target).value)"
                 (blur)="checkNameAvailable()" />
          @if (nameHint()) {
            <span class="field-hint" [class.error]="nameValid() === false" [class.valid]="nameValid() === true">
              {{ nameHint() }}
            </span>
          }
        </div>

        <!-- Keys -->
        <div class="form-group">
          <div class="label-row">
            <label>Owner public key</label>
            <button class="btn-ghost btn-small" type="button" (click)="generate()">Generate keys</button>
          </div>
          <input class="form-input mono" type="text" spellcheck="false"
                 placeholder="EOS… or PUB_K1_…"
                 [class.input-invalid]="ownerKey() !== '' && !isPubKey(ownerKey())"
                 [value]="ownerKey()"
                 (input)="onOwnerInput($any($event.target).value)" />
          @if (generatedOwnerWif()) {
            <div class="key-reveal">
              <span class="key-reveal-label">Owner private key — save it now, it is shown only once</span>
              <div class="key-reveal-row">
                <code>{{ generatedOwnerWif() }}</code>
                <button class="btn-ghost btn-small" type="button" (click)="copy(generatedOwnerWif())">Copy</button>
              </div>
            </div>
          }
        </div>

        <div class="form-group">
          <label class="check-label">
            <input type="checkbox" [checked]="sameKey()" (change)="onSameKeyToggle($any($event.target).checked)" />
            Use the same key for the active permission
          </label>
        </div>

        @if (!sameKey()) {
          <div class="form-group">
            <div class="label-row">
              <label>Active public key</label>
              <button class="btn-ghost btn-small" type="button" (click)="generateActive()">Generate</button>
            </div>
            <input class="form-input mono" type="text" spellcheck="false"
                   placeholder="EOS… or PUB_K1_…"
                   [class.input-invalid]="activeKey() !== '' && !isPubKey(activeKey())"
                   [value]="activeKey()"
                   (input)="onActiveInput($any($event.target).value)" />
            @if (generatedActiveWif()) {
              <div class="key-reveal">
                <span class="key-reveal-label">Active private key — save it now, it is shown only once</span>
                <div class="key-reveal-row">
                  <code>{{ generatedActiveWif() }}</code>
                  <button class="btn-ghost btn-small" type="button" (click)="copy(generatedActiveWif())">Copy</button>
                </div>
              </div>
            }
          </div>
        }

        <!-- Resources -->
        <div class="form-row">
          <div class="form-group">
            <label>RAM (KB)</label>
            <input class="form-input mono" type="text" placeholder="8"
                   [value]="ramKb()" (input)="ramKb.set($any($event.target).value)" />
          </div>
          <div class="form-group">
            <label>CPU stake ({{ sym() }})</label>
            <input class="form-input mono" type="text" placeholder="1.0000"
                   [value]="cpuStake()" (input)="cpuStake.set($any($event.target).value)" />
          </div>
          <div class="form-group">
            <label>NET stake ({{ sym() }})</label>
            <input class="form-input mono" type="text" placeholder="0.5000"
                   [value]="netStake()" (input)="netStake.set($any($event.target).value)" />
          </div>
        </div>

        <div class="form-group">
          <label class="check-label">
            <input type="checkbox" [checked]="transferStake()" (change)="transferStake.set($any($event.target).checked)" />
            Transfer staked tokens to the new account (it owns and can unstake them)
          </label>
        </div>

        <div class="cost-line">
          Estimated cost to {{ creator() }}: {{ costSummary() }}
        </div>

        @if (formError()) {
          <p class="banner error">{{ formError() }}</p>
        }

        <button class="btn-primary" [disabled]="!canCreate() || busy()" (click)="onCreate()">
          {{ busy() ? 'Working…' : 'CREATE ACCOUNT' }}
        </button>

        <!-- Success card -->
        @if (created(); as c) {
          <div class="success-card">
            <div class="success-head">
              <span class="success-check">&#10003;</span>
              <span><strong>{{ c.name }}</strong> created</span>
            </div>
            <div class="success-row">
              <span class="k">Account</span>
              <span class="v mono">{{ c.name }}</span>
              @if (explorerUrl(c.name); as url) {
                <a class="explorer-link" [href]="url" target="_blank" rel="noopener">View</a>
              }
            </div>
            <div class="success-row">
              <span class="k">Owner key</span>
              <span class="v mono trunc">{{ c.ownerKey }}</span>
            </div>
            <div class="success-row">
              <span class="k">Active key</span>
              <span class="v mono trunc">{{ c.activeKey }}</span>
            </div>
            <div class="success-actions">
              @if (canImportCreated()) {
                <button class="btn-ghost" type="button" [disabled]="busy()" (click)="importCreated()">
                  Import into wallet
                </button>
              }
              <button class="btn-ghost" type="button" (click)="reset()">Create another</button>
            </div>
            @if (importNote()) {
              <p class="import-note">{{ importNote() }}</p>
            }
          </div>
        }
      </div>

      <!-- ── Recently created ── -->
      <div class="recent-panel">
        <h3>Created here</h3>
        @if (recentForChain().length > 0) {
          <div class="recent-list">
            @for (r of recentForChain(); track r.name + r.chainId) {
              <div class="recent-row">
                <span class="recent-name mono">{{ r.name }}</span>
                @if (explorerUrl(r.name); as url) {
                  <a class="explorer-link" [href]="url" target="_blank" rel="noopener">View</a>
                }
              </div>
            }
          </div>
        } @else {
          <p class="recent-empty">Accounts you create on this chain will be listed here.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .create-layout {
      display: grid;
      grid-template-columns: 1fr 240px;
      gap: var(--sp-6);
      max-width: 920px;
    }
    h2 { font-size: 24px; margin-bottom: var(--sp-2); }
    .lede { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }
    .lede .payer { color: var(--accent); font-family: var(--font-data); }

    .form-group { margin-bottom: var(--sp-5); }
    .form-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); }
    .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-2); }
    .label-row label { margin-bottom: 0; }

    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--sp-2);
    }
    .check-label {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
      color: var(--text-body);
      cursor: pointer;
    }
    .check-label input { accent-color: var(--accent); }

    .form-input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-raised);
      color: var(--text-bright);
      font-size: 14px;
      transition: border-color 150ms ease;
    }
    .form-input.mono { font-family: var(--font-data); }
    .form-input::placeholder { color: var(--text-disabled); }
    .input-valid { border-color: var(--positive) !important; }
    .input-invalid { border-color: var(--negative) !important; }

    .field-hint { display: block; font-size: 11px; margin-top: var(--sp-1); color: var(--text-muted); }
    .field-hint.error { color: var(--negative); }
    .field-hint.valid { color: var(--positive); }

    .key-reveal {
      margin-top: var(--sp-2);
      padding: var(--sp-3);
      border: 1px solid var(--caution);
      border-radius: var(--radius-sm);
      background: rgba(230, 180, 60, 0.08);
    }
    .key-reveal-label { display: block; font-size: 11px; color: var(--caution); margin-bottom: var(--sp-2); }
    .key-reveal-row { display: flex; align-items: center; gap: var(--sp-2); }
    .key-reveal-row code {
      flex: 1;
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-bright);
      word-break: break-all;
    }

    .cost-line { font-size: 12px; color: var(--text-muted); margin-bottom: var(--sp-4); }

    .btn-primary {
      width: 100%;
      padding: var(--sp-3);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-ghost {
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-data);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-ghost:hover:not(:disabled) { background: var(--accent-muted); }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-small { white-space: nowrap; }

    .banner {
      font-size: 12px;
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      margin-bottom: var(--sp-4);
    }
    .banner.error { color: var(--negative); background: rgba(240, 90, 90, 0.08); }

    .success-card {
      margin-top: var(--sp-5);
      padding: var(--sp-4);
      border: 1px solid var(--positive);
      border-radius: var(--radius-md);
      background: rgba(45, 212, 168, 0.06);
    }
    .success-head {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: 15px;
      color: var(--positive);
      margin-bottom: var(--sp-3);
    }
    .success-check { font-size: 18px; font-weight: 700; }
    .success-row {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: 12px;
      padding: var(--sp-1) 0;
    }
    .success-row .k { width: 72px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .success-row .v { color: var(--text-bright); }
    .success-row .v.trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
    .mono { font-family: var(--font-data); }
    .explorer-link { font-size: 12px; color: var(--accent); text-decoration: none; }
    .explorer-link:hover { text-decoration: underline; }
    .success-actions { display: flex; gap: var(--sp-2); margin-top: var(--sp-3); }
    .import-note { font-size: 12px; color: var(--text-muted); margin-top: var(--sp-2); }

    .recent-panel {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
      align-self: flex-start;
    }
    .recent-panel h3 { font-size: 14px; font-weight: 600; margin-bottom: var(--sp-3); }
    .recent-empty { font-size: 12px; color: var(--text-disabled); }
    .recent-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-2);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .recent-name { font-size: 12px; color: var(--text-bright); }
  `],
})
export class CreateAccountComponent {
  // ── Form state ──
  newName = signal('');
  ownerKey = signal('');
  activeKey = signal('');
  sameKey = signal(true);
  ramKb = signal('8');
  cpuStake = signal('1.0000');
  netStake = signal('0.5000');
  transferStake = signal(false);

  generatedOwnerWif = signal('');
  generatedActiveWif = signal('');

  nameValid = signal<boolean | null>(null);
  nameHint = signal('');
  formError = signal('');
  busy = signal(false);

  created = signal<CreatedRecord | null>(null);
  importNote = signal('');
  private recent = signal<CreatedRecord[]>([]);

  private nameTimer: any;

  creator = computed(() => this.wallet.selectedAccount()?.name ?? '');

  recentForChain = computed(() => {
    const chainId = this.wallet.selectedAccount()?.chainId;
    return this.recent().filter(r => r.chainId === chainId).slice().reverse();
  });

  /** The created account's active key lives in our keystore only when we generated it. */
  canImportCreated = computed(() => !!this.created() && this.generatedActiveWif() !== '');

  costSummary = computed(() => {
    const cpu = parseFloat(this.cpuStake() || '0');
    const net = parseFloat(this.netStake() || '0');
    const staked = cpu + net;
    const parts: string[] = [`${this.ramKb() || '0'} KB RAM`];
    if (staked > 0) parts.push(`${staked.toFixed(this.prec())} ${this.sym()} staked`);
    return parts.join(' + ');
  });

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
  ) {
    this.loadRecent();
  }

  /** User typed an owner key by hand — the generated WIF (if any) no longer
   *  matches, so drop it. Mirror to the active key while "same key" is on. */
  onOwnerInput(value: string) {
    const key = value.trim();
    this.ownerKey.set(key);
    this.generatedOwnerWif.set('');
    if (this.sameKey()) {
      this.activeKey.set(key);
      this.generatedActiveWif.set('');
    }
  }

  onActiveInput(value: string) {
    this.activeKey.set(value.trim());
    this.generatedActiveWif.set('');
  }

  sym(): string { return this.wallet.activeChain()?.symbol ?? 'EOS'; }
  prec(): number { return this.wallet.activeChain()?.precision ?? 4; }

  isPubKey(k: string): boolean {
    return /^(EOS|PUB_K1_|PUB_R1_)[1-9A-HJ-NP-Za-km-z]{40,}$/.test(k.trim());
  }

  private nameSyntaxValid(name: string): boolean {
    // a–z, 1–5 and dots; max 12 chars. 12-char names (or dotted sub-names of a
    // suffix the creator owns) can be created directly; shorter bare names need
    // a name-bid auction, so we steer callers toward the direct-create case.
    if (!/^[a-z1-5.]{1,12}$/.test(name)) return false;
    return name.length === 12 || name.includes('.');
  }

  onNameInput(value: string) {
    const name = value.toLowerCase().trim();
    this.newName.set(name);
    this.nameValid.set(null);
    this.formError.set('');
    clearTimeout(this.nameTimer);
    if (!name) { this.nameHint.set(''); return; }
    if (!/^[a-z1-5.]{1,12}$/.test(name)) {
      this.nameValid.set(false);
      this.nameHint.set('Only a–z, 1–5 and dots; max 12 characters.');
      return;
    }
    if (!this.nameSyntaxValid(name)) {
      this.nameHint.set('Tip: bare names shorter than 12 chars need a name bid. Use a full 12-char name.');
    } else {
      this.nameHint.set('');
    }
    // Debounced availability check as the user types a plausible name.
    this.nameTimer = setTimeout(() => this.checkNameAvailable(), 500);
  }

  /** Confirm the name is free — a creatable name must NOT already exist on chain. */
  async checkNameAvailable() {
    const name = this.newName();
    const chainId = this.wallet.selectedAccount()?.chainId;
    if (!name || !chainId || !this.nameSyntaxValid(name)) return;
    try {
      await this.ipc.getAccount(chainId, name);
      // getAccount succeeded → the name is taken.
      this.nameValid.set(false);
      this.nameHint.set('That name is already taken.');
    } catch {
      this.nameValid.set(true);
      this.nameHint.set('Available');
    }
  }

  onSameKeyToggle(checked: boolean) {
    this.sameKey.set(checked);
    if (checked) {
      this.activeKey.set(this.ownerKey());
      this.generatedActiveWif.set(this.generatedOwnerWif());
    } else {
      // Detaching: clear the mirrored generated WIF so it isn't shown as active's.
      if (this.activeKey() === this.ownerKey()) this.generatedActiveWif.set('');
    }
  }

  async generate() {
    try {
      const kp = await this.ipc.generateKeyPair();
      this.ownerKey.set(kp.public_key);
      this.generatedOwnerWif.set(kp.wif);
      if (this.sameKey()) {
        this.activeKey.set(kp.public_key);
        this.generatedActiveWif.set(kp.wif);
      }
    } catch (e: any) {
      this.formError.set(this.msg(e));
    }
  }

  async generateActive() {
    try {
      const kp = await this.ipc.generateKeyPair();
      this.activeKey.set(kp.public_key);
      this.generatedActiveWif.set(kp.wif);
    } catch (e: any) {
      this.formError.set(this.msg(e));
    }
  }

  async copy(text: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  canCreate(): boolean {
    if (!this.wallet.canSign()) return false;
    if (this.nameValid() === false) return false;
    if (!this.nameSyntaxValid(this.newName())) return false;
    if (!this.isPubKey(this.ownerKey())) return false;
    if (!this.sameKey() && !this.isPubKey(this.activeKey())) return false;
    const ram = parseFloat(this.ramKb() || '0');
    if (!(ram > 0)) return false;
    return true;
  }

  async onCreate() {
    this.formError.set('');
    const account = this.wallet.selectedAccount();
    if (!account) return;
    const creator = account.name;

    const ownerK = this.ownerKey().trim();
    const activeK = (this.sameKey() ? this.ownerKey() : this.activeKey()).trim();
    const name = this.newName();
    const bytes = Math.round(parseFloat(this.ramKb() || '0') * 1024);
    const cpu = parseFloat(this.cpuStake() || '0');
    const net = parseFloat(this.netStake() || '0');

    const keys = await this.ipc.listPublicKeys(account.chainId);
    if (keys.length === 0) {
      this.formError.set('No signing key found for this account.');
      return;
    }

    const auth = [{ actor: creator, permission: 'active' }];
    const authority = (key: string) => ({
      threshold: 1,
      keys: [{ key, weight: 1 }],
      accounts: [],
      waits: [],
    });

    const actions: any[] = [
      {
        account: this.wallet.systemAccount('newaccount'),
        name: 'newaccount',
        authorization: auth,
        data: { creator, name, owner: authority(ownerK), active: authority(activeK) },
      },
      {
        account: this.wallet.systemAccount('buyrambytes'),
        name: 'buyrambytes',
        authorization: auth,
        data: { payer: creator, receiver: name, bytes },
      },
    ];

    if (cpu > 0 || net > 0) {
      actions.push({
        account: this.wallet.systemAccount('delegatebw'),
        name: 'delegatebw',
        authorization: auth,
        data: {
          from: creator,
          receiver: name,
          stake_net_quantity: `${net.toFixed(this.prec())} ${this.sym()}`,
          stake_cpu_quantity: `${cpu.toFixed(this.prec())} ${this.sym()}`,
          transfer: this.transferStake(),
        },
      });
    }

    this.busy.set(true);
    try {
      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey: keys[0],
        actions,
        title: `Create ${name}`,
      });

      if (result) {
        const record: CreatedRecord = {
          name,
          chainId: account.chainId,
          ownerKey: ownerK,
          activeKey: activeK,
          createdAt: Date.now(),
        };
        this.created.set(record);
        this.importNote.set('');
        await this.rememberCreated(record);
        // The creator just spent RAM + stake — refresh its balances.
        this.wallet.refreshAccount(this.wallet.selectedIndex());
      }
    } catch (e: any) {
      this.formError.set(this.msg(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** Import the freshly created account's key + add it by name. Only possible
   *  when we generated the active key here (so its WIF is in hand). */
  async importCreated() {
    const c = this.created();
    const wif = this.generatedActiveWif();
    if (!c || !wif) return;
    this.busy.set(true);
    this.importNote.set('');
    try {
      await this.ipc.importKeyWithSession(wif, c.chainId);
      // Also stash the owner key if it differs and we hold it.
      const ownerWif = this.generatedOwnerWif();
      if (ownerWif && ownerWif !== wif) {
        try { await this.ipc.importKeyWithSession(ownerWif, c.chainId); } catch { /* non-fatal */ }
      }
      await this.wallet.addImportedAccount(c.name, c.chainId, 'full');
      this.importNote.set(`${c.name} added to your wallet. Back up the private key — it won't be shown again.`);
    } catch (e: any) {
      this.importNote.set(`Import failed: ${this.msg(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  explorerUrl(name: string): string | null {
    const explorer = this.wallet.activeChain()?.explorers?.[0];
    const tpl = explorer?.account_url;
    if (!tpl) return null;
    return tpl.replace('{account}', name);
  }

  reset() {
    this.created.set(null);
    this.importNote.set('');
    this.newName.set('');
    this.ownerKey.set('');
    this.activeKey.set('');
    this.generatedOwnerWif.set('');
    this.generatedActiveWif.set('');
    this.nameValid.set(null);
    this.nameHint.set('');
    this.formError.set('');
  }

  // ── Persistence of created records ──

  private async loadRecent() {
    try {
      const saved = await this.ipc.storeGet<CreatedRecord[]>('created_accounts');
      if (saved?.length) this.recent.set(saved);
    } catch { /* ignore */ }
  }

  private async rememberCreated(record: CreatedRecord) {
    const next = [...this.recent(), record];
    this.recent.set(next);
    try { await this.ipc.storeSet('created_accounts', next); } catch { /* ignore */ }
  }

  private msg(e: any): string {
    const raw = typeof e === 'string' ? e : e?.message ?? String(e);
    const m = raw.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (m) {
      try {
        const p = JSON.parse(m[0]);
        const d = p?.error?.details;
        if (Array.isArray(d) && d.length) return d[0].message ?? raw;
        if (p?.error?.what) return p.error.what;
      } catch { /* fall through */ }
    }
    return raw.slice(0, 400);
  }
}
