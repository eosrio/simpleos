import { NgTemplateOutlet } from '@angular/common';
import { Component, Injector, computed, effect, runInInjectionContext, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  AbiAction,
  AbiFieldKind,
  AbiFormField,
  AbiTransactionBuilderService,
  BuilderActionDraft,
  BuilderAuthorization,
  BuiltTransactionExport,
  LoadedAbi,
  initialValueForType,
} from '../../../core/services/abi-transaction-builder.service';
import { SignedTransactionResult, TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { WalletStateService } from '../../../core/services/wallet-state.service';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [FormField, NgTemplateOutlet],
  template: `
    <div class="contracts-workbench">
      <section class="contract-pane">
        <div class="pane-header">
          <span class="eyebrow">Contract</span>
          <h2>ABI Builder</h2>
        </div>

        <div class="contract-search">
          <input class="mono-input" type="text"
                 placeholder="eosio.token"
                 [value]="contractName()"
                 (input)="contractName.set($any($event.target).value)"
                 (keydown.enter)="loadAbi()" />
          <button class="icon-btn accent" type="button" title="Fetch ABI" (click)="loadAbi()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="icon-btn" type="button" title="Refresh ABI" (click)="loadAbi(true)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>

        @if (abiStatus()) {
          <div class="status-line" [class.error]="abiError()">
            <span class="status-dot"></span>
            <span>{{ abiStatus() }}</span>
          </div>
        }

        @if (abiError()) {
          <div class="paste-fallback">
            <button class="text-btn" type="button" (click)="showPasteAbi.update(v => !v)">
              {{ showPasteAbi() ? 'Hide pasted ABI' : 'Paste ABI JSON' }}
            </button>
            @if (showPasteAbi()) {
              <textarea class="json-area" rows="8" placeholder='{"version":"eosio::abi/1.2","actions":[],"structs":[]}'
                        [value]="pastedAbi()"
                        (input)="pastedAbi.set($any($event.target).value)"></textarea>
              <button class="secondary-btn" type="button" (click)="importPastedAbi()">Use pasted ABI</button>
            }
          </div>
        }

        @if (builder.recentContracts().length > 0) {
          <div class="recent-list">
            <span class="section-label">Recent</span>
            @for (contract of builder.recentContracts(); track contract) {
              <button type="button" class="recent-chip" (click)="useRecent(contract)">{{ contract }}</button>
            }
          </div>
        }

        @if (loadedAbi(); as loaded) {
          <div class="abi-source">
            <span>{{ loaded.account }}</span>
            <strong>{{ loaded.source }}</strong>
          </div>

          <div class="action-filter">
            <input type="search" class="plain-input"
                   placeholder="Filter actions"
                   [value]="actionFilter()"
                   (input)="actionFilter.set($any($event.target).value)" />
          </div>

          <div class="action-list">
            @for (action of filteredActions(); track action.name) {
              <button type="button"
                      class="action-item"
                      [class.active]="selectedAction()?.name === action.name"
                      (click)="selectAction(action)">
                <span class="action-name">{{ action.name }}</span>
                <span class="action-type">{{ action.type }}</span>
              </button>
            }
          </div>
        } @else {
          <div class="empty-panel">
            <span class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.3 6.3a2.1 2.1 0 0 1-3-3l6.3-6.3a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/></svg>
            </span>
            <p>Fetch a contract ABI to begin.</p>
          </div>
        }
      </section>

      <section class="form-pane">
        @if (selectedAction(); as action) {
          <div class="action-title-row">
            <div>
              <span class="eyebrow">Action</span>
              <h2>{{ contractName().trim() }}::{{ action.name }}</h2>
            </div>
            <div class="segmented">
              <button type="button" [class.active]="mode() === 'guided'" (click)="setMode('guided')">Form</button>
              <button type="button" [class.active]="mode() === 'raw'" (click)="setMode('raw')">JSON</button>
            </div>
          </div>

          @if (action.ricardian_contract) {
            <details class="ricardian">
              <summary>Ricardian contract</summary>
              <p>{{ action.ricardian_contract }}</p>
            </details>
          }

          <div class="authorization-editor">
            <div class="subheader">
              <span>Authorization</span>
              <button class="mini-btn" type="button" (click)="addAuthorization()">Add</button>
            </div>
            @for (auth of authorization(); track $index; let i = $index) {
              <div class="auth-row">
                <input class="mono-input compact" type="text" placeholder="actor"
                       [value]="auth.actor"
                       (input)="updateAuthorization(i, 'actor', $any($event.target).value)" />
                <span>@</span>
                <input class="mono-input compact" type="text" placeholder="permission"
                       [value]="auth.permission"
                       (input)="updateAuthorization(i, 'permission', $any($event.target).value)" />
                <button class="icon-btn small" type="button" title="Remove authorization" (click)="removeAuthorization(i)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            }
          </div>

          @if (mode() === 'guided') {
            <div class="dynamic-form">
              @for (field of actionFields(); track field.id) {
                <ng-container [ngTemplateOutlet]="fieldTemplate"
                              [ngTemplateOutletContext]="{ $implicit: field, depth: 0 }"></ng-container>
              }
              @if (actionFields().length === 0) {
                <div class="empty-inline">This action has no ABI fields.</div>
              }
            </div>
          } @else {
            <textarea class="json-area tall" spellcheck="false"
                      [value]="rawJson()"
                      (input)="rawJson.set($any($event.target).value)"></textarea>
          }

          @if (formError()) {
            <div class="inline-error">{{ formError() }}</div>
          }

          <div class="form-actions">
            <button class="secondary-btn" type="button" (click)="resetCurrentAction()">Reset</button>
            <button class="primary-btn" type="button" (click)="addCurrentAction()">Add to transaction</button>
          </div>
        } @else {
          <div class="large-empty">
            <h2>Select an action</h2>
            <p>Actions are generated from the loaded contract ABI.</p>
          </div>
        }
      </section>

      <aside class="transaction-pane">
        <div class="pane-header slim">
          <span class="eyebrow">Transaction</span>
          <h2>{{ transactionActions().length }} action{{ transactionActions().length === 1 ? '' : 's' }}</h2>
        </div>

        @if (transactionActions().length > 0) {
          <div class="stack-list">
            @for (draft of transactionActions(); track draft.id; let i = $index) {
              <div class="stack-card">
                <div class="stack-main">
                  <span class="stack-contract">{{ draft.account }}</span>
                  <strong>{{ draft.name }}</strong>
                  <span>{{ draft.authorization.length }} auth</span>
                </div>
                <div class="stack-controls">
                  <button class="icon-btn small" type="button" title="Move up" [disabled]="i === 0" (click)="moveAction(i, -1)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button class="icon-btn small" type="button" title="Move down" [disabled]="i === transactionActions().length - 1" (click)="moveAction(i, 1)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <button class="icon-btn small" type="button" title="Duplicate" (click)="duplicateAction(i)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  <button class="icon-btn small danger" type="button" title="Remove" (click)="removeAction(i)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-panel compact-empty">
            <p>Add one or more actions to build a transaction.</p>
          </div>
        }

        <div class="json-preview">
          <div class="subheader">
            <span>Payload</span>
            <button class="mini-btn" type="button" (click)="copyPreview()">Copy</button>
          </div>
          <pre>{{ previewJson() }}</pre>
        </div>

        @if (signedOutput(); as signed) {
          <div class="signed-output">
            <div class="subheader">
              <span>Signed output</span>
              <button class="mini-btn" type="button" (click)="copySigned()">Copy</button>
            </div>
            <code>{{ signed.signature }}</code>
          </div>
        }

        @if (executionError()) {
          <div class="inline-error">{{ executionError() }}</div>
        }

        <div class="execute-grid">
          <button class="secondary-btn" type="button" [disabled]="!hasExecutableActions()" (click)="exportTransaction()">Export</button>
          <button class="secondary-btn" type="button" [disabled]="!canSign()" (click)="signOnly()">Sign only</button>
          <button class="primary-btn" type="button" [disabled]="!canSign()" (click)="pushTransaction()">Broadcast</button>
        </div>
      </aside>
    </div>

    <ng-template #fieldTemplate let-field let-depth="depth">
      <div class="field-shell" [style.margin-left.px]="depth * 14" [class.nested]="depth > 0">
        @if (isNullableField(field) && isNullAtPath(field.path)) {
          <label class="field-label">
            <span>{{ field.label }}</span>
            <em>{{ field.type }}</em>
          </label>
          <button class="secondary-btn field-enable" type="button" (click)="enableNullableField(field)">Set value</button>
        } @else if (field.kind === 'object') {
          <details class="object-field" open>
            <summary>
              <span>{{ field.label }}</span>
              <em>{{ field.resolvedType }}</em>
            </summary>
            @for (child of field.children; track child.id) {
              <ng-container [ngTemplateOutlet]="fieldTemplate"
                            [ngTemplateOutletContext]="{ $implicit: child, depth: depth + 1 }"></ng-container>
            }
          </details>
        } @else if (field.kind === 'boolean') {
          <label class="check-row">
            <input type="checkbox" [formField]="fieldFor(field.path)" />
            <span>{{ field.label }}</span>
            <em>{{ field.type }}</em>
          </label>
          @if (isNullableField(field)) {
            <button class="mini-btn" type="button" (click)="clearNullableField(field)">Clear</button>
          }
        } @else if (field.kind === 'array' || field.kind === 'variant') {
          <label class="field-label">
            <span>{{ field.label }}</span>
            <em>{{ field.kind === 'array' ? field.itemType + '[]' : 'variant' }}</em>
          </label>
          <textarea class="json-area mini" spellcheck="false"
                    [placeholder]="field.placeholder"
                    [value]="jsonAtPath(field.path)"
                    (input)="setJsonAtPath(field.path, $any($event.target).value)"></textarea>
          @if (field.variantTypes?.length) {
            <span class="field-help">Allowed variant types: {{ field.variantTypes!.join(', ') }}</span>
          }
        } @else {
          <label class="field-label">
            <span>{{ field.label }}</span>
            <em>{{ field.type }}</em>
          </label>
          <input class="form-input"
                 [class.mono]="isMonoKind(field.kind)"
                 [type]="field.kind === 'number' ? 'number' : 'text'"
                 [placeholder]="field.placeholder"
                 [formField]="fieldFor(field.path)" />
          @if (isNullableField(field)) {
            <button class="mini-btn" type="button" (click)="clearNullableField(field)">Clear</button>
          }
        }
      </div>
    </ng-template>
  `,
  styles: [`
    .contracts-workbench {
      min-height: 100%;
      display: grid;
      grid-template-columns: minmax(245px, 0.8fr) minmax(420px, 1.45fr) minmax(300px, 0.95fr);
      gap: var(--sp-5);
      align-items: start;
    }

    .contract-pane,
    .form-pane,
    .transaction-pane {
      min-width: 0;
      background: color-mix(in srgb, var(--bg-raised) 92%, var(--chain-tint));
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }

    .contract-pane,
    .transaction-pane {
      position: sticky;
      top: 0;
      max-height: calc(100vh - 112px);
      overflow: auto;
      padding: var(--sp-4);
    }

    .form-pane {
      padding: var(--sp-5);
    }

    .pane-header,
    .action-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-4);
      margin-bottom: var(--sp-4);
    }

    .pane-header.slim {
      margin-bottom: var(--sp-3);
    }

    h2 {
      margin: 2px 0 0;
      font-size: 20px;
      line-height: 1.15;
    }

    .eyebrow,
    .section-label,
    .subheader {
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .contract-search {
      display: grid;
      grid-template-columns: 1fr 34px 34px;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
    }

    .mono-input,
    .plain-input,
    .form-input,
    .json-area {
      width: 100%;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-bright);
      font-size: 13px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .mono-input,
    .form-input.mono,
    .json-area,
    pre,
    code {
      font-family: var(--font-data);
    }

    .mono-input,
    .plain-input,
    .form-input {
      height: 34px;
      padding: 0 var(--sp-3);
    }

    .mono-input.compact {
      height: 30px;
      padding: 0 var(--sp-2);
    }

    .json-area {
      resize: vertical;
      padding: var(--sp-3);
      line-height: 1.45;
      min-height: 92px;
    }

    .json-area.tall {
      min-height: 420px;
    }

    .json-area.mini {
      min-height: 72px;
      margin-top: var(--sp-2);
    }

    .icon-btn {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-muted);
      cursor: pointer;
      transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
    }

    .icon-btn svg {
      width: 16px;
      height: 16px;
    }

    .icon-btn:hover:not(:disabled),
    .icon-btn.accent {
      color: var(--accent);
      border-color: color-mix(in srgb, var(--accent) 48%, var(--border-subtle));
      background: var(--accent-muted);
    }

    .icon-btn.small {
      width: 28px;
      height: 28px;
    }

    .icon-btn.danger:hover {
      color: var(--negative);
      border-color: color-mix(in srgb, var(--negative) 48%, var(--border-subtle));
      background: rgba(240, 68, 56, 0.08);
    }

    .icon-btn:disabled,
    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .status-line {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
      color: var(--text-muted);
      font-size: 12px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: var(--radius-full);
      background: var(--positive);
    }

    .status-line.error .status-dot {
      background: var(--negative);
    }

    .paste-fallback,
    .recent-list,
    .authorization-editor,
    .json-preview,
    .signed-output {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin-top: var(--sp-4);
    }

    .recent-list {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }

    .recent-chip,
    .text-btn,
    .mini-btn {
      border: 0;
      background: transparent;
      color: var(--accent);
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 700;
    }

    .recent-chip {
      padding: 5px 8px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-full);
      background: var(--bg-base);
      font-family: var(--font-data);
      font-weight: 600;
    }

    .abi-source {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-muted);
      font-family: var(--font-data);
      font-size: 12px;
      margin-bottom: var(--sp-3);
    }

    .abi-source strong {
      color: var(--accent);
      text-transform: uppercase;
    }

    .action-filter {
      margin-bottom: var(--sp-3);
    }

    .action-list,
    .stack-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .action-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--sp-2);
      align-items: center;
      width: 100%;
      min-height: 38px;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-body);
      text-align: left;
      cursor: pointer;
    }

    .action-item.active,
    .action-item:hover {
      border-color: color-mix(in srgb, var(--accent) 42%, var(--border-subtle));
      background: var(--accent-muted);
    }

    .action-name,
    .stack-contract {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-data);
      color: var(--text-bright);
      font-size: 13px;
      font-weight: 700;
    }

    .action-type,
    .stack-main span {
      color: var(--text-muted);
      font-family: var(--font-data);
      font-size: 11px;
    }

    .segmented {
      display: inline-flex;
      padding: 3px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
    }

    .segmented button {
      min-width: 58px;
      height: 28px;
      border: 0;
      border-radius: 3px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-weight: 700;
    }

    .segmented button.active {
      background: var(--accent);
      color: #fff;
    }

    .ricardian {
      margin-bottom: var(--sp-4);
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-muted);
      font-size: 12px;
    }

    .ricardian summary {
      cursor: pointer;
      color: var(--text-body);
      font-weight: 700;
    }

    .subheader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-2);
      margin-bottom: var(--sp-1);
    }

    .auth-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 0.75fr) 28px;
      gap: var(--sp-2);
      align-items: center;
    }

    .dynamic-form {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      margin-top: var(--sp-5);
    }

    .field-shell {
      min-width: 0;
    }

    .field-shell.nested {
      padding-left: var(--sp-3);
      border-left: 2px solid var(--border-subtle);
    }

    .field-label {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      margin-bottom: var(--sp-2);
      color: var(--text-body);
      font-size: 12px;
      font-weight: 700;
      text-transform: capitalize;
    }

    .field-label em,
    .check-row em,
    .object-field summary em {
      color: var(--text-disabled);
      font-family: var(--font-data);
      font-size: 11px;
      font-style: normal;
      text-transform: none;
    }

    .check-row {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      min-height: 34px;
      color: var(--text-body);
      font-size: 13px;
      font-weight: 700;
    }

    .object-field {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      padding: var(--sp-3);
    }

    .object-field summary {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      cursor: pointer;
      color: var(--text-bright);
      font-size: 13px;
      font-weight: 700;
      text-transform: capitalize;
    }

    .object-field[open] summary {
      margin-bottom: var(--sp-3);
    }

    .field-help {
      display: block;
      margin-top: var(--sp-1);
      color: var(--text-disabled);
      font-size: 11px;
    }

    .field-enable {
      width: auto;
      min-width: 118px;
    }

    .form-actions,
    .execute-grid {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: var(--sp-3);
      margin-top: var(--sp-5);
    }

    .execute-grid {
      grid-template-columns: 1fr 1fr 1.15fr;
    }

    .primary-btn,
    .secondary-btn {
      min-height: 36px;
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
    }

    .primary-btn {
      border: 0;
      background: var(--accent);
      color: #fff;
    }

    .primary-btn:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .secondary-btn {
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
      color: var(--text-body);
    }

    .secondary-btn:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-muted);
    }

    .stack-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--sp-3);
      align-items: center;
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
    }

    .stack-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: 2px;
    }

    .stack-main strong {
      color: var(--text-bright);
      font-size: 13px;
    }

    .stack-controls {
      display: grid;
      grid-template-columns: repeat(2, 28px);
      gap: 5px;
    }

    .json-preview pre {
      max-height: 260px;
      overflow: auto;
      margin: 0;
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-body);
      font-size: 11px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .signed-output code {
      display: block;
      padding: var(--sp-3);
      border: 1px solid color-mix(in srgb, var(--positive) 32%, var(--border-subtle));
      border-radius: var(--radius-sm);
      background: rgba(45, 212, 168, 0.08);
      color: var(--positive);
      font-size: 11px;
      overflow-wrap: anywhere;
    }

    .empty-panel,
    .large-empty,
    .empty-inline {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 160px;
      gap: var(--sp-3);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      text-align: center;
      background: color-mix(in srgb, var(--bg-base) 86%, transparent);
    }

    .large-empty {
      min-height: 520px;
    }

    .empty-inline {
      min-height: 90px;
    }

    .compact-empty {
      min-height: 120px;
    }

    .empty-icon {
      width: 42px;
      height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      color: var(--accent);
      background: var(--accent-muted);
    }

    .empty-icon svg {
      width: 22px;
      height: 22px;
    }

    .inline-error {
      margin-top: var(--sp-3);
      padding: var(--sp-3);
      border: 1px solid rgba(240, 68, 56, 0.28);
      border-radius: var(--radius-sm);
      background: rgba(240, 68, 56, 0.08);
      color: var(--negative);
      font-size: 12px;
    }

    @media (max-width: 1180px) {
      .contracts-workbench {
        grid-template-columns: 1fr;
      }

      .contract-pane,
      .transaction-pane {
        position: static;
        max-height: none;
      }
    }
  `],
})
export class ContractsComponent {
  readonly contractName = signal('');
  readonly loadedAbi = signal<LoadedAbi | null>(null);
  readonly selectedAction = signal<AbiAction | null>(null);
  readonly actionFilter = signal('');
  readonly abiStatus = signal('');
  readonly abiError = signal('');
  readonly pastedAbi = signal('');
  readonly showPasteAbi = signal(false);
  readonly mode = signal<'guided' | 'raw'>('guided');
  readonly rawJson = signal('{}');
  readonly actionModel = signal<Record<string, any>>({});
  readonly actionForm = signal<any>(null);
  readonly authorization = signal<BuilderAuthorization[]>([]);
  readonly formError = signal('');
  readonly executionError = signal('');
  readonly signedOutput = signal<SignedTransactionResult | null>(null);
  readonly transactionActions = signal<BuilderActionDraft[]>([]);

  readonly filteredActions = computed(() => {
    const abi = this.loadedAbi()?.abi;
    if (!abi) return [];
    const query = this.actionFilter().trim().toLowerCase();
    const actions = [...abi.actions].sort((left, right) => left.name.localeCompare(right.name));
    if (!query) return actions;
    return actions.filter(action =>
      action.name.toLowerCase().includes(query) ||
      action.type.toLowerCase().includes(query)
    );
  });

  readonly actionFields = computed(() => {
    const loaded = this.loadedAbi();
    const action = this.selectedAction();
    if (!loaded || !action) return [];
    return this.builder.createFieldTree(loaded.abi, action.type);
  });

  readonly previewActions = computed(() => {
    try {
      return this.collectActions().map(draft => this.builder.toTxAction(draft));
    } catch {
      return [];
    }
  });

  readonly previewJson = computed(() => JSON.stringify(this.previewActions(), null, 2));

  constructor(
    public wallet: WalletStateService,
    public builder: AbiTransactionBuilderService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
    private injector: Injector,
  ) {
    effect(() => {
      const account = this.wallet.selectedAccount();
      const chain = this.wallet.activeChain();
      if (!account || !chain) return;
      this.builder.loadRecentContracts(account.chainId);
      if (!this.contractName()) {
        this.contractName.set(chain.token_contract || 'eosio.token');
      }
    });
  }

  async loadAbi(refresh = false) {
    const account = this.wallet.selectedAccount();
    if (!account) return;

    this.abiStatus.set('Fetching ABI...');
    this.abiError.set('');
    this.showPasteAbi.set(false);
    this.selectedAction.set(null);
    this.formError.set('');

    try {
      const loaded = await this.builder.fetchAbi(account.chainId, this.contractName(), refresh);
      this.loadedAbi.set(loaded);
      this.contractName.set(loaded.account);
      this.abiStatus.set(`Loaded ${loaded.abi.actions.length} actions from ${loaded.source}`);
      const first = loaded.abi.actions[0];
      if (first) this.selectAction(first);
    } catch (error: any) {
      this.loadedAbi.set(null);
      this.abiError.set(error?.message ?? String(error));
      this.abiStatus.set('ABI fetch failed. Paste ABI JSON to continue.');
    }
  }

  async importPastedAbi() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    try {
      const loaded = await this.builder.importPastedAbi(account.chainId, this.contractName(), this.pastedAbi());
      this.loadedAbi.set(loaded);
      this.contractName.set(loaded.account);
      this.abiError.set('');
      this.abiStatus.set(`Loaded ${loaded.abi.actions.length} actions from pasted ABI`);
      this.showPasteAbi.set(false);
      const first = loaded.abi.actions[0];
      if (first) this.selectAction(first);
    } catch (error: any) {
      this.abiError.set(error?.message ?? String(error));
    }
  }

  useRecent(contract: string) {
    this.contractName.set(contract);
    this.loadAbi();
  }

  selectAction(action: AbiAction) {
    const loaded = this.loadedAbi();
    const account = this.wallet.selectedAccount();
    if (!loaded || !account) return;
    const draft = this.builder.createActionDraft(loaded.abi, loaded.account, action, account.name);
    this.selectedAction.set(action);
    this.setActionModel(draft.data);
    this.authorization.set(draft.authorization);
    this.rawJson.set(draft.rawJson);
    this.mode.set('guided');
    this.formError.set('');
  }

  setMode(next: 'guided' | 'raw') {
    this.formError.set('');
    if (next === 'raw') {
      this.rawJson.set(JSON.stringify(this.actionModel(), null, 2));
      this.mode.set(next);
      return;
    }

    try {
      this.setActionModel(JSON.parse(this.rawJson() || '{}'));
      this.mode.set(next);
    } catch {
      this.formError.set('Raw JSON is invalid. Fix it before returning to form mode.');
    }
  }

  resetCurrentAction() {
    const action = this.selectedAction();
    if (action) this.selectAction(action);
  }

  addAuthorization() {
    const account = this.wallet.selectedAccount();
    this.authorization.update(list => [...list, { actor: account?.name ?? '', permission: 'active' }]);
  }

  updateAuthorization(index: number, key: keyof BuilderAuthorization, value: string) {
    this.authorization.update(list => list.map((auth, i) => i === index ? { ...auth, [key]: value } : auth));
  }

  removeAuthorization(index: number) {
    this.authorization.update(list => list.filter((_, i) => i !== index));
  }

  addCurrentAction() {
    try {
      const draft = this.buildCurrentDraft();
      if (!draft.authorization.length) {
        this.formError.set('Add at least one authorization row.');
        return;
      }
      this.transactionActions.update(list => [...list, draft]);
      this.formError.set('');
      this.executionError.set('');
    } catch (error: any) {
      this.formError.set(error?.message ?? String(error));
    }
  }

  duplicateAction(index: number) {
    const source = this.transactionActions()[index];
    if (!source) return;
    this.transactionActions.update(list => [
      ...list.slice(0, index + 1),
      { ...structuredClone(source), id: `${source.id}:copy:${Date.now()}` },
      ...list.slice(index + 1),
    ]);
  }

  removeAction(index: number) {
    this.transactionActions.update(list => list.filter((_, i) => i !== index));
  }

  moveAction(index: number, delta: number) {
    this.transactionActions.update(list => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  hasExecutableActions(): boolean {
    return this.previewActions().length > 0;
  }

  canSign(): boolean {
    const account = this.wallet.selectedAccount();
    return this.hasExecutableActions() && !!account && account.mode === 'full';
  }

  async pushTransaction() {
    await this.executeTransaction('push');
  }

  async signOnly() {
    await this.executeTransaction('signOnly');
  }

  async exportTransaction() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    const payload = this.buildExportPayload(account.chainId, account.name);
    const json = JSON.stringify(payload, null, 2);
    await this.copyText(json);
    this.downloadJson(`simpleos-${account.name}-contract-transaction.json`, json);
  }

  async copyPreview() {
    await this.copyText(this.previewJson());
  }

  async copySigned() {
    const signed = this.signedOutput();
    if (signed) await this.copyText(JSON.stringify(signed, null, 2));
  }

  fieldFor(path: string[]): any {
    let current: any = this.actionForm();
    for (const key of path) current = current?.[key];
    return current;
  }

  isMonoKind(kind: AbiFieldKind): boolean {
    return kind !== 'text';
  }

  isNullableField(field: AbiFormField): boolean {
    return field.optional || field.binaryExtension;
  }

  isNullAtPath(path: string[]): boolean {
    return this.valueAtPath(path) === null;
  }

  enableNullableField(field: AbiFormField) {
    this.setValueAtPath(field.path, initialValueForType(this.loadedAbi()!.abi, field.resolvedType));
  }

  clearNullableField(field: AbiFormField) {
    this.setValueAtPath(field.path, null);
  }

  jsonAtPath(path: string[]): string {
    return JSON.stringify(this.valueAtPath(path), null, 2);
  }

  setJsonAtPath(path: string[], raw: string) {
    try {
      this.setValueAtPath(path, JSON.parse(raw || 'null'));
      this.formError.set('');
    } catch {
      this.formError.set('Field JSON is invalid.');
    }
  }

  private async executeTransaction(mode: 'push' | 'signOnly') {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    if (account.mode !== 'full') {
      this.executionError.set('Watch-only accounts can export, but cannot sign transactions.');
      return;
    }

    try {
      const actions = this.collectActions().map(draft => this.builder.toTxAction(draft));
      const publicKey = await this.findPublicKey(account.chainId);
      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey,
        actions,
        title: mode === 'signOnly' ? 'Sign Contract Transaction' : 'Broadcast Contract Transaction',
        mode,
        ledgerIndex: account.ledgerIndex,
      });

      if (result && 'packed_trx' in result && 'signature' in result
        && typeof result.packed_trx === 'string'
        && typeof result.signature === 'string') {
        this.signedOutput.set({ packed_trx: result.packed_trx, signature: result.signature });
      }
    } catch (error: any) {
      this.executionError.set(error?.message ?? String(error));
    }
  }

  private async findPublicKey(chainId: string): Promise<string> {
    const account = this.wallet.selectedAccount();
    if (account?.ledgerIndex !== undefined) return 'ledger';
    const keys = await this.ipc.listPublicKeys(chainId);
    if (keys.length === 0) throw new Error('No signing key found for this account.');
    return keys[0];
  }

  private buildCurrentDraft(): BuilderActionDraft {
    const loaded = this.loadedAbi();
    const action = this.selectedAction();
    if (!loaded || !action) throw new Error('Select an action first.');
    const data = this.mode() === 'raw' ? JSON.parse(this.rawJson() || '{}') : structuredClone(this.actionModel());
    return {
      id: `${loaded.account}:${action.name}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      account: loaded.account,
      name: action.name,
      authorization: this.authorization().filter(auth => auth.actor.trim() && auth.permission.trim()),
      data,
      mode: this.mode(),
      abiStructName: action.type,
      rawJson: this.mode() === 'raw' ? this.rawJson() : JSON.stringify(data, null, 2),
    };
  }

  private collectActions(): BuilderActionDraft[] {
    const stack = this.transactionActions();
    if (stack.length > 0) return stack;
    if (!this.selectedAction()) return [];
    return [this.buildCurrentDraft()];
  }

  private buildExportPayload(chainId: string, accountName: string): BuiltTransactionExport {
    const loaded = this.loadedAbi();
    const actions = this.collectActions().map(draft => this.builder.toTxAction(draft));
    return {
      chainId,
      account: accountName,
      actions,
      createdAt: new Date().toISOString(),
      abiSource: loaded?.source ?? 'mixed',
    };
  }

  private valueAtPath(path: string[]): any {
    let current: any = this.actionModel();
    for (const key of path) current = current?.[key];
    return current;
  }

  private setValueAtPath(path: string[], value: any) {
    const next = structuredClone(this.actionModel());
    let cursor: any = next;
    for (let i = 0; i < path.length - 1; i++) {
      cursor[path[i]] ??= {};
      cursor = cursor[path[i]];
    }
    cursor[path[path.length - 1]] = value;
    this.setActionModel(next);
  }

  private setActionModel(model: Record<string, any>) {
    this.actionModel.set(model);
    this.actionForm.set(runInInjectionContext(this.injector, () => form(this.actionModel)));
  }

  private async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be unavailable in browser-only tests.
    }
  }

  private downloadJson(filename: string, text: string) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
