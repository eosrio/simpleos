// Temporary review probes: assertions document current behavior, not acceptance criteria.
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SendComponent } from './send';
import { ContactsService } from '../../../core/services/contacts.service';

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
    const ipc = {getAccount: vi.fn().mockResolvedValue(account.info), ledgerGetPublicKey: vi.fn().mockResolvedValue('bob-public-key'), listPublicKeys: vi.fn().mockResolvedValue(mode === 'ledger' ? [] : ['alice-public-key','bob-public-key'])};
    const tx = {confirm: vi.fn().mockResolvedValue(null)};
    TestBed.configureTestingModule({providers:[{provide:ContactsService,useValue:{load:vi.fn(),list:()=>[]}}]});
    const component = TestBed.runInInjectionContext(() => new SendComponent(wallet as any,ipc as any,tx as any));
    component.recipient.set('carol'); component.amount.set('1');
    return {component,ipc,tx};
  }
  it('uses the selected account active key even when another chain key comes first', async () => {
    const {component,tx}=setup('full'); await component.onSend();
    expect(tx.confirm).toHaveBeenCalled();
    expect(tx.confirm.mock.calls[0][0].publicKey).toBe('bob-public-key');
    expect(tx.confirm.mock.calls[0][0].actions[0].authorization[0].actor).toBe('bob');
  });
  it('requests hardware signing when the selected account uses Ledger', async () => {
    const {component,tx}=setup('ledger'); await component.onSend();
    expect(tx.confirm).toHaveBeenCalled();
    expect(tx.confirm.mock.calls[0][0].ledgerIndex).toBe(2);
  });
  it('rejects an invalid thirteenth recipient character', async () => {
    const {component,tx}=setup('full'); component.recipient.set('abcdefghijklz');
    await component.onSend();
    expect(tx.confirm).not.toHaveBeenCalled();
    expect(component.sendError()).toContain('Invalid account name');
  });
  it('does not sign when the recipient lookup fails', async () => {
    const {component,ipc,tx}=setup('full');
    ipc.getAccount.mockImplementation(async (_chain: string, name: string) => {
      if (name === 'carol') throw new Error('offline');
      return {permissions:[{perm_name:'active',required_auth:{threshold:1,keys:[{key:'bob-public-key',weight:1}]}}]} as any;
    });
    await component.onSend();
    expect(tx.confirm).not.toHaveBeenCalled();
    expect(component.sendError()).toContain('Could not verify');
  });
});
