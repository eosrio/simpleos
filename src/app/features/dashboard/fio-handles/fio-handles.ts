import { Component, effect, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { FioApiService, FioNamesResponse } from '../../../core/services/fio-api.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';

const TPID = 'bp@eosrio';
type ActiveModal = 'none' | 'regaddress' | 'regdomain';

@Component({
  selector: 'app-fio-handles',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fio-view">
      <h2>FIO Handles & Domains</h2>

      @if (loading()) {
        <div class="section-card loading-state">
          <div class="spinner-small"></div>
          <span>Loading your FIO identifiers...</span>
        </div>
      } @else {
        <!-- Handles Section -->
        <div class="section-card">
          <div class="section-header">
            <h3>Your Crypto Handles</h3>
            <button class="btn-primary" (click)="openModal('regaddress')">REGISTER HANDLE</button>
          </div>
          <p class="section-desc">Crypto Handles (name&#64;domain) replace complex public addresses across different blockchains.</p>

          @if (names()?.fio_addresses?.length === 0) {
            <div class="empty-state">You don't own any FIO Crypto Handles yet.</div>
          } @else {
            <div class="table-container">
              <div class="table-header">
                <span class="col-name">Crypto Handle</span>
                <span class="col-date">Expirations</span>
              </div>
              @for (addr of names()?.fio_addresses; track addr.fio_address) {
                <div class="table-row">
                  <span class="col-name data">{{ addr.fio_address }}</span>
                  <span class="col-date">{{ addr.expiration }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Domains Section -->
        <div class="section-card">
          <div class="section-header">
            <h3>Your Domains</h3>
            <button class="btn-primary" (click)="openModal('regdomain')">REGISTER DOMAIN</button>
          </div>
          <p class="section-desc">Domains are the suffix part of a FIO Handle. If you own a domain, you can create addresses on it.</p>

          @if (names()?.fio_domains?.length === 0) {
            <div class="empty-state">You don't own any FIO Domains.</div>
          } @else {
            <div class="table-container">
              <div class="table-header">
                <span class="col-name">Domain</span>
                <span class="col-date">Expirations</span>
                <span class="col-status">Visibility</span>
                <span class="col-actions">Actions</span>
              </div>
              @for (dom of names()?.fio_domains; track dom.fio_domain) {
                <div class="table-row">
                  <span class="col-name data">&#64;{{ dom.fio_domain }}</span>
                  <span class="col-date">{{ dom.expiration }}</span>
                  <span class="col-status">
                    <span class="panel-badge">{{ dom.is_public === 1 ? 'Public' : 'Private' }}</span>
                  </span>
                  <span class="col-actions">
                    <button class="btn-ghost btn-sm" (click)="onRenewDomain(dom.fio_domain)">RENEW</button>
                  </span>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Custom Modals -->
      @if (activeModal() !== 'none') {
        <div class="overlay" (click)="onOverlayClick($event)">
          <div class="modal">
            <div class="modal-header">
              <h3>{{ activeModal() === 'regaddress' ? 'Register Crypto Handle' : 'Register Domain' }}</h3>
            </div>
            
            <div class="modal-body">
              @if (activeModal() === 'regaddress') {
                <div class="form-group">
                  <label>Crypto Handle</label>
                  <div class="handle-input-row">
                    <input class="form-input" type="text" placeholder="username" 
                           [value]="inputPrefix()" (input)="inputPrefix.set($any($event.target).value)" />
                    <span class="at-symbol">&#64;</span>
                    <input class="form-input" type="text" placeholder="domain (e.g. eosrio)" 
                           [value]="inputDomain()" (input)="inputDomain.set($any($event.target).value)" />
                  </div>
                </div>
              } @else {
                <div class="form-group">
                  <label>Domain Name</label>
                  <div class="handle-input-row">
                    <span class="at-symbol">&#64;</span>
                    <input class="form-input" type="text" placeholder="yourdomain" 
                           [value]="inputDomain()" (input)="inputDomain.set($any($event.target).value)" />
                  </div>
                </div>
              }

              @if (feeLoading()) {
                <div class="fee-estimate loading-state">
                   <div class="spinner-small" style="width:16px;height:16px;border-width:2px;"></div> Calculating fee...
                </div>
              } @else if (feeEstimates() > 0) {
                <div class="fee-estimate">Estimated Fee: <span class="data">{{ formatFee(feeEstimates()) }} FIO</span></div>
              }

              @if (errorMessage()) {
                <div class="inline-error">{{ errorMessage() }}</div>
              }
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="closeModal()">Cancel</button>
              <button class="btn-confirm" (click)="submitModal()" 
                      [disabled]="feeLoading() || (activeModal() === 'regaddress' && !inputPrefix()) || !inputDomain()">
                Review Transaction
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .fio-view { max-width: 860px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
      margin-bottom: var(--sp-6);
    }
    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--sp-2);
    }
    .section-header h3 { font-size: 16px; }
    .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }
    .loading-state { display: flex; align-items: center; gap: var(--sp-3); color: var(--text-muted); }
    .empty-state { font-size: 13px; color: var(--text-muted); padding: var(--sp-4); text-align: center; background: var(--bg-base); border-radius: var(--radius-sm); border: 1px dashed var(--border-subtle); }
    
    .panel-badge {
      font-family: var(--font-data); font-size: 10px; font-weight: 500;
      color: var(--accent); background: var(--accent-muted);
      padding: 2px var(--sp-2); border-radius: var(--radius-full);
    }

    .table-container { font-size: 13px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-base); }
    .table-header, .table-row {
      display: grid;
      grid-template-columns: 2fr 1fr 100px 100px;
      padding: var(--sp-3) var(--sp-4);
      align-items: center;
    }
    /* Addresses table doesn't need status/actions columns */
    .section-card:first-of-type .table-header, .section-card:first-of-type .table-row {
      grid-template-columns: 1fr 1fr;
    }
    
    .table-header { font-size: 11px; font-weight: 500; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border-subtle); }
    .table-row { color: var(--text-body); border-bottom: 1px solid var(--border-subtle); }
    .table-row:last-child { border-bottom: none; }
    .data { font-family: var(--font-data); color: var(--text-bright); }
    .col-actions { text-align: right; }

    /* Modals */
    .overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: var(--backdrop-blur); backdrop-filter: blur(4px); }
    .modal { width: 400px; background: var(--bg-raised); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-modal); }
    .modal-header { padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--border-subtle); }
    .modal-header h3 { font-size: 16px; font-weight: 600; margin: 0; }
    .modal-body { padding: var(--sp-5); }
    .modal-actions { display: flex; gap: var(--sp-3); padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--border-subtle); }
    
    .form-group { margin-bottom: var(--sp-4); }
    label { display: block; font-size: 11px; font-weight: 500; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--sp-2); }
    .handle-input-row { display: flex; align-items: center; gap: var(--sp-2); }
    .at-symbol { color: var(--text-muted); font-size: 16px; font-weight: 600; }
    
    .form-input { flex: 1; padding: var(--sp-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-base); color: var(--text-bright); font-family: var(--font-data); outline: none; }
    .form-input:focus { border-color: var(--accent); }
    
    .fee-estimate { font-size: 12px; color: var(--text-muted); margin-top: var(--sp-2); text-align: right; }
    .inline-error { margin-top: var(--sp-3); font-size: 12px; color: var(--negative); }
    
    /* Buttons */
    .btn-row { display: flex; gap: var(--sp-3); align-items: center; }
    .btn-primary { padding: var(--sp-2) var(--sp-5); border: none; border-radius: var(--radius-sm); background: var(--accent); color: #fff; font-family: var(--font-body); font-size: 12px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: background 150ms ease; }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost { padding: var(--sp-1) var(--sp-3); border: 1px solid var(--accent); border-radius: var(--radius-sm); background: transparent; color: var(--accent); font-family: var(--font-body); font-size: 11px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: background 150ms ease; }
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-cancel, .btn-confirm { flex: 1; padding: var(--sp-3); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 13px; font-weight: 500; cursor: pointer; transition: background 150ms ease; }
    .btn-cancel { background: var(--bg-base); color: var(--text-muted); border: 1px solid var(--border-subtle); }
    .btn-cancel:hover { background: var(--bg-hover); }
    .btn-confirm { background: var(--accent); color: #fff; border: none; }
    .btn-confirm:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
    
    .spinner-small { width: 24px; height: 24px; border: 3px solid var(--border-subtle); border-top-color: var(--accent); border-radius: 50%; animation: spin 800ms linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class FioHandlesComponent {
  wallet = inject(WalletStateService);
  fioApi = inject(FioApiService);
  tx = inject(TransactionService);
  ipc = inject(TauriIpcService);

  loading = signal(true);
  names = signal<FioNamesResponse | null>(null);

  // Modal State
  activeModal = signal<ActiveModal>('none');
  inputPrefix = signal('');
  inputDomain = signal('');
  feeEstimates = signal<number>(0);
  feeLoading = signal(false);
  errorMessage = signal('');

  constructor() {
    effect(() => {
      const active = this.wallet.selectedAccount();
      if (active && active.chainId) {
        this.loadNames();
      }
    });

    // Auto-fetch fee when inputs change
    effect(() => {
      const mode = this.activeModal();
      const prefix = this.inputPrefix();
      const dom = this.inputDomain();
      
      if (mode !== 'none') {
        if (mode === 'regaddress' && prefix && dom) {
          this.fetchFee('register_fio_address');
        } else if (mode === 'regdomain' && dom) {
          this.fetchFee('register_fio_domain');
        }
      }
    });
  }

  async loadNames() {
    this.loading.set(true);
    try {
      const acct = this.wallet.selectedAccount();
      if (!acct) return;
      // FIO's get_fio_names requires the FIO-prefixed public key.
      // The local keystore stores EOS/PUB_K1_ format, so extract the key
      // from the on-chain account permissions instead.
      const activePermission = acct.info?.permissions?.find(
        (p: any) => p.perm_name === 'active'
      );
      const rawKey = activePermission?.required_auth?.keys?.[0]?.key;
      if (rawKey) {
        // On-chain permission keys are stored EOS/PUB_K1_ format; get_fio_names
        // needs the FIO-prefixed form.
        const fioKey = await this.ipc.toFioPublicKey(rawKey);
        const result = await this.fioApi.getFioNames(acct.chainId, fioKey);
        this.names.set(result);
      }
    } catch (e) {
      console.warn('Failed to fetch FIO names', e);
    } finally {
      this.loading.set(false);
    }
  }

  openModal(type: ActiveModal) {
    this.activeModal.set(type);
    this.inputPrefix.set('');
    this.inputDomain.set('');
    this.errorMessage.set('');
    this.feeEstimates.set(0);
  }

  closeModal() {
    this.activeModal.set('none');
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this.closeModal();
    }
  }

  async fetchFee(endpoint: string) {
    this.feeLoading.set(true);
    this.errorMessage.set('');
    try {
      const acct = this.wallet.selectedAccount();
      if (!acct) return;
      const fee = await this.fioApi.getFee(acct.chainId, endpoint, '');
      this.feeEstimates.set(fee);
    } catch (e: any) {
      this.errorMessage.set('Failed to calculate exact fee from network.');
    } finally {
      this.feeLoading.set(false);
    }
  }

  formatFee(sufs: number): string {
    return (sufs / 1e9).toFixed(2);
  }

  private auth() { 
    return [{ actor: this.wallet.selectedAccount()?.name ?? '', permission: 'active' }]; 
  }

  async submitModal() {
    const mode = this.activeModal();
    const acct = this.wallet.selectedAccount();
    if (!acct) return;

    const keys = await this.ipc.listPublicKeys(acct.chainId);
    if (!keys || keys.length === 0) return;
    const pubkey = keys[0];
    // pubkey is keystore (EOS/PUB_K1_) format — fine for signing, but FIO
    // action fields require the FIO-prefixed form or the chain rejects with
    // "Invalid FIO Public Key".
    const fioPubkey = await this.ipc.toFioPublicKey(pubkey);

    try {
      if (mode === 'regaddress') {
        const fullAddress = `${this.inputPrefix()}@${this.inputDomain()}`;
        await this.tx.confirm({
          chainId: acct.chainId,
          publicKey: pubkey,
          title: 'Register Crypto Handle',
          actions: [{
            account: 'fio.address',
            name: 'regaddress',
            authorization: this.auth(),
            data: {
              fio_address: fullAddress,
              owner_fio_public_key: fioPubkey,
              max_fee: this.feeEstimates(),
              actor: acct.name,
              tpid: TPID
            }
          }]
        });
      } else if (mode === 'regdomain') {
        await this.tx.confirm({
          chainId: acct.chainId,
          publicKey: pubkey,
          title: 'Register Domain',
          actions: [{
            account: 'fio.address',
            name: 'regdomain',
            authorization: this.auth(),
            data: {
              fio_domain: this.inputDomain(),
              owner_fio_public_key: fioPubkey,
              max_fee: this.feeEstimates(),
              actor: acct.name,
              tpid: TPID
            }
          }]
        });
      }
      this.closeModal();
      setTimeout(() => this.loadNames(), 1500); // refresh list
    } catch (e) {
      // User cancelled or error
    }
  }

  async onRenewDomain(domain: string) {
    const acct = this.wallet.selectedAccount();
    if (!acct) return;
    
    try {
      const keys = await this.ipc.listPublicKeys(acct.chainId);
      const fee = await this.fioApi.getFee(acct.chainId, 'renew_fio_domain', '');
      
      await this.tx.confirm({
        chainId: acct.chainId,
        publicKey: keys[0],
        title: 'Renew Domain',
        actions: [{
          account: 'fio.address',
          name: 'renewdomain',
          authorization: this.auth(),
          data: {
            fio_domain: domain,
            max_fee: fee,
            actor: acct.name,
            tpid: TPID
          }
        }]
      });
      setTimeout(() => this.loadNames(), 1500);
    } catch { }
  }
}
