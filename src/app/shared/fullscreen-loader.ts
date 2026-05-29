import { Component, inject } from '@angular/core';
import { LoaderService } from '../core/services/loader.service';

/**
 * Fullscreen branded loader.
 *
 * Reacts to `LoaderService.visible`. Renders the SimplEOS gem as an
 * inline SVG so individual facets can be animated (sequential light
 * refraction, sweeping highlight, pulsing glow).
 *
 * Kept self-contained — no external deps beyond LoaderService — so it
 * can be mounted anywhere (app root, modals, feature shells).
 */
@Component({
  selector: 'app-fullscreen-loader',
  standalone: true,
  template: `
    @if (loader.visible()) {
      <div class="loader-overlay" role="alertdialog" aria-live="assertive" aria-busy="true">
        <div class="loader-backdrop"></div>

        <div class="loader-stage">
          <div class="gem-wrap">
            <!-- Radial glow behind the gem -->
            <div class="gem-glow"></div>

            <!-- Orbital rings -->
            <div class="orbit orbit-a"></div>
            <div class="orbit orbit-b"></div>

            <!-- The logo, rebuilt inline so each facet is individually animatable -->
            <svg class="gem" viewBox="0 0 338.8 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <linearGradient id="ldrFacetTop" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#a0d4f7" stop-opacity="0.95"/>
                  <stop offset="40%" stop-color="#5bb8f0" stop-opacity="0.7"/>
                  <stop offset="100%" stop-color="#2a8fd4" stop-opacity="0.55"/>
                </linearGradient>
                <linearGradient id="ldrFacetBody" x1="0%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stop-color="#68c4f5" stop-opacity="0.6"/>
                  <stop offset="30%" stop-color="#3a9fe0" stop-opacity="0.45"/>
                  <stop offset="70%" stop-color="#1a7cc0" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="#0e5a94" stop-opacity="0.5"/>
                </linearGradient>
                <linearGradient id="ldrFacetLeft" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#4db0e8" stop-opacity="0.5"/>
                  <stop offset="50%" stop-color="#1a7cc0" stop-opacity="0.4"/>
                  <stop offset="100%" stop-color="#0a4f7a" stop-opacity="0.65"/>
                </linearGradient>
                <linearGradient id="ldrFacetRight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.55"/>
                  <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.4"/>
                  <stop offset="100%" stop-color="#0e7ec7" stop-opacity="0.6"/>
                </linearGradient>

                <filter id="ldrGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                  <feColorMatrix in="blur" type="matrix"
                    values="0 0 0 0 0.0
                            0 0 0 0 0.58
                            0 0 0 0 0.82
                            0 0 0 0.5 0" result="colored"/>
                  <feMerge>
                    <feMergeNode in="colored"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              <g filter="url(#ldrGlow)">
                <!-- Top crown facet -->
                <polygon class="facet facet-top"
                  points="169.4,19.36 262.28,76.22 170.49,76.22 168.31,76.22 76.52,76.22"
                  fill="url(#ldrFacetTop)"/>

                <!-- Main inverted triangle body -->
                <polygon class="facet facet-body"
                  points="168.31,79.05 170.49,79.05 264.87,79.05 169.4,247.6 73.92,79.05"
                  fill="url(#ldrFacetBody)"/>

                <!-- Left lower facet -->
                <polygon class="facet facet-left"
                  points="105.81,227.04 74.9,86.53 167.89,250.69 167.89,311.08"
                  fill="url(#ldrFacetLeft)"/>

                <!-- Right lower facet -->
                <polygon class="facet facet-right"
                  points="232.99,227.04 170.91,311.08 170.91,250.69 263.9,86.53"
                  fill="url(#ldrFacetRight)"/>

                <!-- Crisp facet edges -->
                <g class="edges" stroke="#a0d4f7" stroke-width="0.8" fill="none" stroke-linejoin="round">
                  <polygon points="169.4,19.36 264.87,79.05 169.4,311.08 73.92,79.05" stroke-opacity="0.45"/>
                  <line x1="169.4" y1="19.36" x2="169.4" y2="311.08" stroke-opacity="0.35"/>
                  <line x1="73.92" y1="79.05" x2="264.87" y2="79.05" stroke-opacity="0.25"/>
                </g>
              </g>
            </svg>
          </div>

          <h2 class="loader-message">
            {{ loader.message() }}<span class="ellipsis"><span>.</span><span>.</span><span>.</span></span>
          </h2>
          @if (loader.hint(); as h) {
            <p class="loader-hint">{{ h }}</p>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }

    .loader-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: all;
      animation: ldrFadeIn 220ms ease-out;
    }

    .loader-backdrop {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(
          ellipse at 50% 45%,
          rgba(6, 20, 36, 0.93) 0%,
          rgba(2, 6, 12, 0.98) 50%,
          rgba(0, 0, 0, 0.99) 100%
        );
      backdrop-filter: blur(32px);
      -webkit-backdrop-filter: blur(32px);
    }

    .loader-stage {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-5, 20px);
      padding: var(--sp-6, 24px);
    }

    /* ── Gem container + glow ───────────────────────────── */
    .gem-wrap {
      position: relative;
      width: 180px;
      height: 180px;
      display: grid;
      place-items: center;
      animation: ldrFloat 4.5s ease-in-out infinite;
    }

    .gem-glow {
      position: absolute;
      inset: -40%;
      border-radius: 50%;
      background:
        radial-gradient(circle,
          rgba(91, 184, 240, 0.45) 0%,
          rgba(0, 148, 210, 0.25) 30%,
          rgba(14, 90, 148, 0.05) 60%,
          transparent 75%
        );
      filter: blur(12px);
      animation: ldrPulse 2.8s ease-in-out infinite;
    }

    .orbit {
      position: absolute;
      border-radius: 50%;
      border: 1px solid rgba(125, 211, 252, 0.18);
      pointer-events: none;
    }
    .orbit-a {
      inset: -6%;
      border-top-color: rgba(125, 211, 252, 0.55);
      border-right-color: rgba(125, 211, 252, 0.25);
      animation: ldrSpin 3.6s linear infinite;
    }
    .orbit-b {
      inset: -14%;
      border-style: dashed;
      border-color: rgba(125, 211, 252, 0.1);
      border-top-color: rgba(125, 211, 252, 0.35);
      animation: ldrSpin 6.2s linear infinite reverse;
    }

    .gem {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    /* ── Independent facet animations ──────────────────── */
    .facet {
      transform-box: fill-box;
      transform-origin: center;
    }

    /* Body: static anchor, only opacity pulses */
    .facet-body {
      animation: ldrFacetBody 2.4s ease-in-out infinite;
    }

    /* Crown, left, right: beat outward from center and back, synced */
    .facet-top {
      animation: ldrFacetTop 2.4s ease-in-out infinite;
    }
    .facet-left {
      animation: ldrFacetLeft 2.4s ease-in-out infinite;
    }
    .facet-right {
      animation: ldrFacetRight 2.4s ease-in-out infinite;
    }

    .edges {
      animation: ldrEdgeShimmer 3.6s ease-in-out infinite;
    }

    /* ── Text ───────────────────────────────────────────── */
    .loader-message {
      margin: 0;
      font-family: var(--font-body, 'Inter', sans-serif);
      font-size: 16px;
      font-weight: 500;
      letter-spacing: 0.4px;
      color: var(--text-bright, #e5f3ff);
      text-align: center;
      text-shadow: 0 0 24px rgba(91, 184, 240, 0.25);
    }

    .loader-hint {
      margin: 0;
      font-size: 12px;
      color: var(--text-muted, #8aa2b8);
      letter-spacing: 0.3px;
      text-align: center;
      max-width: 320px;
    }

    .ellipsis {
      display: inline-block;
      width: 1.4em;
      text-align: left;
    }
    .ellipsis span {
      opacity: 0;
      animation: ldrDot 1.4s infinite;
    }
    .ellipsis span:nth-child(1) { animation-delay: 0ms; }
    .ellipsis span:nth-child(2) { animation-delay: 200ms; }
    .ellipsis span:nth-child(3) { animation-delay: 400ms; }

    /* ── Keyframes ──────────────────────────────────────── */
    @keyframes ldrFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes ldrFloat {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50%      { transform: translateY(-6px) rotate(0.6deg); }
    }

    @keyframes ldrPulse {
      0%, 100% { opacity: 0.55; transform: scale(0.96); }
      50%      { opacity: 0.95; transform: scale(1.06); }
    }

    @keyframes ldrSpin {
      to { transform: rotate(360deg); }
    }

    /* Body: static, only breathes opacity */
    @keyframes ldrFacetBody {
      0%, 100% { opacity: 0.5; }
      50%      { opacity: 1; }
    }

    /* Crown beats upward from center */
    @keyframes ldrFacetTop {
      0%, 100% {
        transform: translateY(0);
        opacity: 0.7;
      }
      40% {
        transform: translateY(-8px);
        opacity: 1;
      }
    }

    /* Left beats outward (down-left) */
    @keyframes ldrFacetLeft {
      0%, 100% {
        transform: translate(0, 0);
        opacity: 0.7;
      }
      40% {
        transform: translate(-6px, 4px);
        opacity: 1;
      }
    }

    /* Right beats outward (down-right) */
    @keyframes ldrFacetRight {
      0%, 100% {
        transform: translate(0, 0);
        opacity: 0.7;
      }
      40% {
        transform: translate(6px, 4px);
        opacity: 1;
      }
    }

    @keyframes ldrEdgeShimmer {
      0%, 100% { opacity: 0.5; }
      50%      { opacity: 1; }
    }

    @keyframes ldrDot {
      0%, 60%, 100% { opacity: 0; }
      30%           { opacity: 1; }
    }

    /* Respect reduced-motion preference */
    @media (prefers-reduced-motion: reduce) {
      .gem-wrap,
      .gem-glow,
      .orbit,
      .facet,
      .edges,
      .ellipsis span {
        animation-duration: 3s;
        animation-iteration-count: infinite;
      }
      .gem-wrap { animation: none; }
      .facet-top, .facet-body, .facet-left, .facet-right { animation: none; opacity: 0.8; }
      .orbit-a, .orbit-b { animation: ldrSpin 12s linear infinite; }
    }
  `],
})
export class FullscreenLoaderComponent {
  protected loader = inject(LoaderService);
}
