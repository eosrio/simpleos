// Temporary review probes: assertions document current behavior, not acceptance criteria.
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SendComponent } from './features/dashboard/send/send';
import { ContactsService } from './core/services/contacts.service';

describe('production readiness signing probes', () => {
  afterEach(() => TestBed.resetTestingModule());
  function setup(mode: 'full' | 'ledger') {
    const account = {
      name: 'bob', chainId: 'review-chain', mode: 'full', ledgerIndex: mode === 'ledger' ? 2 : undefined,
      info: { core_liquid_balance: '10.0000 EOS', permissions: [{perm_name:'active', required_auth:{threshold:1,keys:[{key:'bob-public-key',weight:1}],accounts:[],waits:[]}}] }
    };
    const wallet = {
      selectedAccount: signal(account), activeChain: signal({id:'review-chain',name:'Review',symbol:'EOS',precision:4,token_contract:'eosio.token',exchanges:[]}),
      accounts: signal([account]), isFio: () => false,
    };
    const ipc = {listPublicKeys: vi.fn().mockResolvedValue(mode === 'ledger' ? [] : ['alice-public-key','bob-public-key'])};
    const tx = {confirm: vi.fn().mockResolvedValue(null)};
    TestBed.configureTestingModule({providers:[{provide:ContactsService,useValue:{load:vi.fn(),list:()=>[]}}]});
    const component = TestBed.runInInjectionContext(() => new SendComponent(wallet as any,ipc as any,tx as any));
    component.recipient.set('carol'); component.amount.set('1');
    return {component,ipc,tx};
  }
  it('uses the first chain key instead of the selected account active key', async () => {
    const {component,tx}=setup('full'); await component.onSend();
    expect(tx.confirm).toHaveBeenCalled();
    expect(tx.confirm.mock.calls[0][0].publicKey).toBe('alice-public-key');
    expect(tx.confirm.mock.calls[0][0].actions[0].authorization[0].actor).toBe('bob');
  });
  it('rejects Ledger send before requesting hardware signing', async () => {
    const {component,tx}=setup('ledger'); await component.onSend();
    expect(tx.confirm).not.toHaveBeenCalled();
    expect(component.sendError()).toContain('watch-only');
  });
});
