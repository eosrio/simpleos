import { Component, computed, effect, OnDestroy, signal, untracked } from '@angular/core';
import { AccountInfo, TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { WalletAccount, WalletStateService } from '../../../core/services/wallet-state.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { resolveAccountSigner } from '../../../core/services/account-signer';

interface ActionLink { contract: string; action: string; permission: string }

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
  readonly permissions = computed(() => (this.info()?.permissions ?? []).filter(p => p.perm_name !== 'owner'));
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
    try {
      const info = await this.ipc.getAccount(account.chainId, account.name);
      if (!this.isCurrent(account, generation) || request !== this.accountRequest) return;
      this.info.set(info);
      if (!info.permissions.some(p => p.perm_name === this.permission())) this.permission.set('');
    } catch (error) {
      if (this.isCurrent(account, generation) && request === this.accountRequest) {
        this.info.set(null);
        this.loadError.set(`Could not load permissions. Refresh to try again. ${this.message(error)}`);
      }
    } finally {
      if (this.isCurrent(account, generation) && request === this.accountRequest) this.loading.set(false);
    }
  }

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
          account: 'eosio', name: 'linkauth',
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
