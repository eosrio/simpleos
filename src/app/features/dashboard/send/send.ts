import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService, TokenBalance } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';

/** Known exchange accounts that require a memo. */
const EXCHANGE_ACCOUNTS = new Set([
  'binancecleos', 'bitaborteoss', 'bitfinexdep1', 'kaborteosact',
  'kaborteosrex', 'kraaborteoss', 'gateiowallet', 'huabortefees',
  'okbtothemoon', 'mexcaborteos', 'byaborteosll',
]);

interface TokenOption {
  label: string;
  symbol: string;
  contract: string;
  precision: number;
  balance: string;
}

export interface Contact {
  name: string;
  account: string;
  chainId?: string;
  memo?: string;
}

@Component({
  selector: 'app-send',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="send-layout">
      <!-- Send form -->
      <div class="send-form">
        <h2>Send</h2>

        <!-- Token selector -->
        <div class="form-group">
          <label>Token</label>
          <select class="form-input"
                  [value]="selectedTokenIdx()"
                  (change)="selectedTokenIdx.set(+$any($event.target).value)">
            @for (tok of tokenOptions(); track tok.symbol + tok.contract; let i = $index) {
              <option [value]="i">{{ tok.symbol }} — {{ tok.balance }}</option>
            }
          </select>
        </div>

        <!-- Recipient -->
        <div class="form-group">
          <label>{{ isFio() ? 'FIO Handle or Public Key' : 'Recipient' }}</label>
          <input class="form-input" type="text"
                 [class.input-valid]="recipientValid() === true"
                 [class.input-invalid]="recipientValid() === false"
                 [placeholder]="isFio() ? 'user@domain or FIO public key' : 'Account name (e.g. bob.gm)'"
                 [value]="recipient()"
                 (input)="onRecipientInput($any($event.target).value)"
                 (blur)="validateRecipient()" />
          @if (recipientValid() === false && recipientHint()) {
            <span class="field-hint error">{{ recipientHint() }}</span>
          }
          @if (recipientValid() === true) {
            <span class="field-hint valid">Account exists</span>
          }
          @if (isExchange()) {
            <span class="field-hint warning">Exchange detected — memo is required</span>
          }
        </div>

        <!-- Amount -->
        <div class="form-group">
          <label>Amount</label>
          <div class="amount-row">
            <input class="form-input" type="text"
                   placeholder="0.0000"
                   [value]="amount()"
                   (input)="amount.set($any($event.target).value)" />
            <button class="btn-ghost btn-small" (click)="setMax()">MAX</button>
          </div>
        </div>

        <!-- Memo (not supported on FIO) -->
        @if (!isFio()) {
        <div class="form-group">
          <label>Memo
            @if (isExchange()) {
              <span class="required">required</span>
            } @else {
              <span class="optional">(optional)</span>
            }
          </label>
          <input class="form-input" type="text"
                 [class.input-invalid]="isExchange() && !memo()"
                 placeholder="Memo"
                 [value]="memo()"
                 (input)="memo.set($any($event.target).value)"
                 maxlength="256" />
          <span class="char-count">{{ memo().length }} / 256</span>
        </div>
        }

        @if (sendError()) {
          <p class="send-error">{{ sendError() }}</p>
        }
        @if (sendSuccess()) {
          <div class="send-success">
            <span class="success-check">&#10003;</span>
            <span>Sent! TX: {{ sendSuccess() }}</span>
          </div>
        }
        <button class="btn-primary" [disabled]="!canSend()" (click)="onSend()">SEND</button>
      </div>

      <!-- Contacts panel -->
      <div class="contacts-panel">
        <div class="contacts-header">
          <h3>Contacts</h3>
          <button class="btn-add" (click)="showAddContact.set(true)" title="Add contact">+</button>
        </div>

        <div class="contacts-search">
          <input class="form-input" type="text" placeholder="Search contacts..."
                 [value]="contactSearch()"
                 (input)="contactSearch.set($any($event.target).value)" />
        </div>

        @if (showAddContact() || editingContact()) {
          <div class="contact-form">
            <input class="form-input" type="text" placeholder="Label (e.g. Alice)"
                   [value]="contactName()"
                   (input)="contactName.set($any($event.target).value)" />
            <input class="form-input" type="text" placeholder="Account name"
                   [value]="contactAccount()"
                   (input)="contactAccount.set($any($event.target).value)" />
            <input class="form-input" type="text" placeholder="Default memo (optional)"
                   [value]="contactMemo()"
                   (input)="contactMemo.set($any($event.target).value)" />
            <div class="contact-form-actions">
              <button class="btn-cancel" (click)="cancelContactForm()">Cancel</button>
              <button class="btn-save" (click)="onSaveContact()"
                      [disabled]="!contactName() || !contactAccount()">
                {{ editingContact() ? 'Update' : 'Save' }}
              </button>
            </div>
          </div>
        }

        @if (filteredContacts().length > 0) {
          <div class="contacts-list">
            @for (contact of filteredContacts(); track contact.account + (contact.chainId ?? '')) {
              <div class="contact-row" (click)="useContact(contact)">
                <div class="contact-info">
                  <span class="contact-name">{{ contact.name }}</span>
                  <span class="contact-account">{{ contact.account }}</span>
                </div>
                <div class="contact-actions" (click)="$event.stopPropagation()">
                  <button class="btn-icon" title="Edit" (click)="onEditContact(contact)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon btn-icon-danger" title="Delete" (click)="onDeleteContact(contact)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            }
          </div>
        } @else if (!showAddContact()) {
          <div class="contacts-empty">
            <p>No contacts yet. Click + to add one, or they'll be suggested after you send.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .send-layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: var(--sp-6);
      max-width: 900px;
    }

    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .form-group {
      margin-bottom: var(--sp-5);
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--sp-2);
    }

    .optional {
      text-transform: none;
      letter-spacing: 0;
      color: var(--text-disabled);
    }

    .form-input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-raised);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .form-input::placeholder { color: var(--text-disabled); }

    .amount-row {
      display: flex;
      gap: var(--sp-2);
    }

    .amount-row .form-input { flex: 1; }

    .char-count {
      display: block;
      text-align: right;
      font-size: 11px;
      color: var(--text-disabled);
      margin-top: var(--sp-1);
    }

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

    .send-error {
      font-size: 12px;
      color: var(--negative);
      margin-bottom: var(--sp-3);
    }

    .send-success {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: 13px;
      color: var(--positive);
      margin-bottom: var(--sp-3);
      padding: var(--sp-2) var(--sp-3);
      background: rgba(45, 212, 168, 0.08);
      border-radius: var(--radius-sm);
    }
    .success-check { font-size: 16px; font-weight: 700; }

    .field-hint {
      display: block;
      font-size: 11px;
      margin-top: var(--sp-1);
    }
    .field-hint.error { color: var(--negative); }
    .field-hint.valid { color: var(--positive); }
    .field-hint.warning { color: var(--caution); }

    .input-valid { border-color: var(--positive) !important; }
    .input-invalid { border-color: var(--negative) !important; }

    .required {
      text-transform: none;
      letter-spacing: 0;
      color: var(--negative);
      font-weight: 600;
    }

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
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-small { white-space: nowrap; }

    /* Contacts panel */
    .contacts-panel {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
      align-self: flex-start;
    }
    .contacts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--sp-3);
    }
    .contacts-header h3 {
      font-size: 14px;
      font-weight: 600;
    }
    .btn-add {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-add:hover { background: var(--accent-muted); }

    .contacts-search { margin-bottom: var(--sp-3); }
    .contacts-search .form-input {
      font-family: var(--font-body);
      font-size: 13px;
      padding: var(--sp-2) var(--sp-3);
    }

    .contacts-empty p {
      font-size: 12px;
      color: var(--text-disabled);
      text-align: center;
      padding: var(--sp-4) 0;
    }

    /* Contact form */
    .contact-form {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-deep);
    }
    .contact-form .form-input {
      font-size: 12px;
      padding: var(--sp-2) var(--sp-3);
    }
    .contact-form-actions {
      display: flex;
      gap: var(--sp-2);
      margin-top: var(--sp-1);
    }
    .btn-cancel, .btn-save {
      flex: 1;
      padding: var(--sp-1) var(--sp-2);
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-cancel {
      border: 1px solid var(--border-subtle);
      background: transparent;
      color: var(--text-muted);
    }
    .btn-save {
      border: none;
      background: var(--accent);
      color: #fff;
    }
    .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Contact list */
    .contacts-list {
      max-height: 400px;
      overflow-y: auto;
    }
    .contact-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background 150ms ease;
    }
    .contact-row:hover { background: var(--bg-hover); }
    .contact-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .contact-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-bright);
    }
    .contact-account {
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
    }
    .contact-actions {
      display: flex;
      gap: var(--sp-1);
      opacity: 0;
      transition: opacity 150ms ease;
    }
    .contact-row:hover .contact-actions { opacity: 1; }
    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }
    .btn-icon:hover { background: var(--bg-hover); color: var(--text-body); }
    .btn-icon-danger:hover { color: var(--negative); }
  `],
})
export class SendComponent {
  recipient = signal('');
  amount = signal('');
  memo = signal('');
  sendError = signal('');
  sendSuccess = signal('');
  selectedTokenIdx = signal(0);

  // Recipient validation
  recipientValid = signal<boolean | null>(null);
  recipientHint = signal('');
  private recipientCheckTimer: any;

  // Token options built from account data
  tokenOptions = computed((): TokenOption[] => {
    const chain = this.wallet.activeChain();
    const acct = this.wallet.selectedAccount();
    if (!chain || !acct) return [];

    const options: TokenOption[] = [{
      label: chain.symbol,
      symbol: chain.symbol,
      contract: chain.token_contract,
      precision: chain.precision,
      balance: acct.info.core_liquid_balance ?? `0.${'0'.repeat(chain.precision)} ${chain.symbol}`,
    }];

    for (const eb of acct.extraBalances ?? []) {
      const parts = eb.amount.split(' ');
      const decimals = parts[0]?.includes('.') ? parts[0].split('.')[1].length : 4;
      options.push({
        label: eb.symbol,
        symbol: eb.symbol,
        contract: eb.contract,
        precision: decimals,
        balance: eb.amount,
      });
    }

    return options;
  });

  /** The currently selected token option. */
  activeToken = computed(() => this.tokenOptions()[this.selectedTokenIdx()] ?? this.tokenOptions()[0]);

  /** Whether the recipient is a known exchange account. */
  isExchange = computed(() => EXCHANGE_ACCOUNTS.has(this.recipient().trim().toLowerCase()));

  /** Whether the active chain is FIO (different transfer model). Covers testnet too. */
  isFio = computed(() => this.wallet.isFio());

  // ── Contacts ──

  contacts = signal<Contact[]>([]);
  contactSearch = signal('');
  showAddContact = signal(false);
  editingContact = signal<Contact | null>(null);
  contactName = signal('');
  contactAccount = signal('');
  contactMemo = signal('');

  filteredContacts = computed(() => {
    const q = this.contactSearch().toLowerCase().trim();
    const list = this.contacts();
    if (!q) return list;
    return list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.account.toLowerCase().includes(q) ||
      (c.memo?.toLowerCase().includes(q) ?? false)
    );
  });

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
  ) {
    // Reset token selection when account changes
    effect(() => {
      this.wallet.selectedAccount();
      this.selectedTokenIdx.set(0);
    });
    this.loadContacts();
  }

  canSend(): boolean {
    if (!this.recipient() || !this.amount()) return false;
    if (this.isExchange() && !this.memo()) return false;
    return true;
  }

  onRecipientInput(value: string) {
    this.recipient.set(value);
    this.recipientValid.set(null);
    this.recipientHint.set('');
    this.sendSuccess.set('');
    clearTimeout(this.recipientCheckTimer);
  }

  /** Validate recipient account exists on blur. */
  async validateRecipient() {
    const name = this.recipient().trim();
    if (!name) return;

    const acct = this.wallet.selectedAccount();
    if (!acct) return;

    // FIO: recipient is a FIO Handle (user@domain) or FIO public key
    if (this.isFio()) {
      if (name.startsWith('FIO')) {
        // Raw FIO public key — accept as-is
        this.recipientValid.set(true);
        this.recipientHint.set('');
      } else if (name.includes('@')) {
        // FIO Handle — resolve to public key
        try {
          const result = await this.ipc.fioGetPubAddress(acct.chainId, name);
          if (result?.public_address) {
            this.recipientValid.set(true);
            this.recipientHint.set('');
          } else {
            this.recipientValid.set(false);
            this.recipientHint.set('FIO Handle not found');
          }
        } catch {
          this.recipientValid.set(false);
          this.recipientHint.set('Could not resolve FIO Handle');
        }
      } else {
        this.recipientValid.set(false);
        this.recipientHint.set('Enter a FIO Handle (user@domain) or FIO public key');
      }
      return;
    }

    // Standard Antelope: account name validation
    const lower = name.toLowerCase();
    if (!/^[a-z1-5.]{1,13}$/.test(lower)) {
      this.recipientValid.set(false);
      this.recipientHint.set('Invalid account name');
      return;
    }

    try {
      await this.ipc.getAccount(acct.chainId, lower);
      this.recipientValid.set(true);
      this.recipientHint.set('');
    } catch {
      this.recipientValid.set(false);
      this.recipientHint.set('Account not found on chain');
    }
  }

  setMax() {
    const tok = this.activeToken();
    if (!tok) return;
    const numPart = tok.balance.split(' ')[0]?.replace(/,/g, '') ?? '0';
    this.amount.set(numPart);
  }

  async onSend() {
    this.sendError.set('');
    this.sendSuccess.set('');
    const account = this.wallet.selectedAccount();
    if (!account) return;

    const tok = this.activeToken();
    if (!tok) return;

    const recipientRaw = this.recipient().trim();

    // Validate amount
    const numAmount = parseFloat(this.amount());
    if (isNaN(numAmount) || numAmount <= 0) {
      this.sendError.set('Enter a valid amount greater than zero');
      return;
    }

    // Check balance
    const balStr = tok.balance.split(' ')[0]?.replace(/,/g, '') ?? '0';
    const balance = parseFloat(balStr);
    if (numAmount > balance) {
      this.sendError.set(`Insufficient balance (available: ${balStr} ${tok.symbol})`);
      return;
    }

    // Find signing key
    const keys = await this.ipc.listPublicKeys(account.chainId);
    if (keys.length === 0) {
      this.sendError.set('No signing key found. This is a watch-only account');
      return;
    }

    let actions: any[];

    if (this.isFio()) {
      // ── FIO transfer: trnsfiopubky ──
      let payeePubKey = recipientRaw;

      // If it's a FIO Handle, resolve to public key first
      if (recipientRaw.includes('@')) {
        try {
          const resolved = await this.ipc.fioGetPubAddress(account.chainId, recipientRaw);
          if (!resolved?.public_address) {
            this.sendError.set('Could not resolve FIO Handle to a public key');
            return;
          }
          payeePubKey = resolved.public_address;
        } catch {
          this.sendError.set('Failed to resolve FIO Handle');
          return;
        }
      }

      if (!payeePubKey.startsWith('FIO')) {
        this.sendError.set('Invalid FIO public key');
        return;
      }

      // Convert to SUFs (integer)
      const sufs = Math.round(numAmount * 1e9);

      // Get fee for transfer
      let maxFee = 2000000000; // default ~2 FIO
      try {
        const feeResult = await this.ipc.fioGetFee(account.chainId, 'transfer_tokens_pub_key', '');
        maxFee = feeResult?.fee ?? maxFee;
      } catch { /* use default */ }

      actions = [{
        account: 'fio.token',
        name: 'trnsfiopubky',
        authorization: [{ actor: account.name, permission: 'active' }],
        data: {
          payee_public_key: payeePubKey,
          amount: sufs,
          max_fee: maxFee,
          actor: account.name,
          tpid: '',
        },
      }];
    } else {
      // ── Standard Antelope transfer ──
      const recipient = recipientRaw.toLowerCase();
      if (!/^[a-z1-5.]{1,13}$/.test(recipient)) {
        this.sendError.set('Invalid account name. Use only a-z, 1-5, and . (max 13 chars)');
        return;
      }
      if (recipient === account.name) {
        this.sendError.set('Cannot send to yourself');
        return;
      }

      // Exchange memo check
      if (this.isExchange() && !this.memo().trim()) {
        this.sendError.set('This is an exchange account — a memo is required');
        return;
      }

      const quantity = `${numAmount.toFixed(tok.precision)} ${tok.symbol}`;

      actions = [{
        account: tok.contract,
        name: 'transfer',
        authorization: [{ actor: account.name, permission: 'active' }],
        data: {
          from: account.name,
          to: recipient,
          quantity,
          memo: this.memo(),
        },
      }];
    }

    const result = await this.tx.confirm({
      chainId: account.chainId,
      publicKey: keys[0],
      actions,
      title: `Send ${tok.symbol}`,
    });

    if (result) {
      this.sendSuccess.set(result.transaction_id.slice(0, 16) + '...');

      // Offer to save as contact if not already saved
      const recipientName = this.recipient().trim();
      if (!this.contacts().some(c => c.account === recipientName)) {
        this.suggestSaveContact(recipientName);
      }

      this.recipient.set('');
      this.amount.set('');
      this.memo.set('');
      this.recipientValid.set(null);
      this.wallet.refreshAccount(this.wallet.selectedIndex());
    }
  }

  // ── Contact Management ──

  private async loadContacts() {
    try {
      const saved = await this.ipc.storeGet<Contact[]>('contacts');
      if (saved && saved.length > 0) {
        this.contacts.set(saved);
      }
    } catch { /* ignore */ }
  }

  private async saveContacts() {
    await this.ipc.storeSet('contacts', this.contacts());
  }

  /** Pre-fill add form with a recently used recipient */
  private suggestSaveContact(account: string) {
    // Auto-show add form with the account pre-filled
    this.contactAccount.set(account);
    this.contactName.set('');
    this.contactMemo.set('');
    this.showAddContact.set(true);
    this.editingContact.set(null);
  }

  cancelContactForm() {
    this.showAddContact.set(false);
    this.editingContact.set(null);
    this.contactName.set('');
    this.contactAccount.set('');
    this.contactMemo.set('');
  }

  async onSaveContact() {
    const name = this.contactName().trim();
    const account = this.contactAccount().trim();
    if (!name || !account) return;

    const chainId = this.wallet.selectedAccount()?.chainId;
    const newContact: Contact = { name, account, chainId, memo: this.contactMemo().trim() || undefined };

    if (this.editingContact()) {
      // Update existing
      const old = this.editingContact()!;
      this.contacts.update(list =>
        list.map(c => (c.account === old.account && c.chainId === old.chainId) ? newContact : c)
      );
    } else {
      // Add new (avoid duplicates)
      if (!this.contacts().some(c => c.account === account && c.chainId === chainId)) {
        this.contacts.update(list => [...list, newContact]);
      }
    }

    await this.saveContacts();
    this.cancelContactForm();
  }

  onEditContact(contact: Contact) {
    this.editingContact.set(contact);
    this.showAddContact.set(false);
    this.contactName.set(contact.name);
    this.contactAccount.set(contact.account);
    this.contactMemo.set(contact.memo ?? '');
  }

  async onDeleteContact(contact: Contact) {
    this.contacts.update(list =>
      list.filter(c => !(c.account === contact.account && c.chainId === contact.chainId))
    );
    await this.saveContacts();
  }

  /** Click a contact to fill the recipient field */
  useContact(contact: Contact) {
    this.recipient.set(contact.account);
    if (contact.memo) this.memo.set(contact.memo);
    this.recipientValid.set(null);
    this.validateRecipient();
  }
}
