'use client';

import React, { useState, useEffect } from 'react';
import { REAL_CART_CSS, CONTROL_HTML } from '../cart-constants';
import { REWARD_ICONS, RewardTier } from '@/lib/addon-definitions';
import { getProtectionIconSvg } from '@/lib/protection-icons';
import { normalizeBlockColorWrap, applyDefaultColor } from './rich-text-editor';
import {
  applyTrustBadges,
  applyScarcityTimer,
  applyShippingProtection,
  applyFreeShippingBar,
  applyUpsellRecommendations,
  applySocialProof,
  applyExpressPayments,
  applyLowStockBadge,
  applyNotes,
  applyCustomCode,
  hideBuiltInTrustLine,
  applyDiscountCode,
  applyTermsCheckbox,
} from './addon-transforms';

const FOCUS_AREAS: Record<string, { scrollTo: string; height: number }> = {
  trustBadges: { scrollTo: 'ccd-trust-badges', height: 220 },
  shippingProtection: { scrollTo: 'ccd-shipping-protection', height: 160 },
  scarcityTimer: { scrollTo: 'ccd-scarcity-badge', height: 180 },
  lowStockBadge: { scrollTo: 'ccd-scarcity-badge', height: 240 },
  freeShippingBar: { scrollTo: 'ccd-progress', height: 180 },
  upsellRecommendations: { scrollTo: 'cart__items', height: 200 },
  socialProof: { scrollTo: 'ccd-trust', height: 160 },
  expressPayments: { scrollTo: 'ccd-express-payments', height: 160 },
  notes: { scrollTo: 'ccd-notes-row', height: 160 },
  discountCode: { scrollTo: 'ccd-discount-code-row', height: 160 },
  termsCheckbox: { scrollTo: 'ccd-terms-row', height: 140 },
};

// Real payment provider SVGs for trust badges preview
const PAYMENT_SVGS: Record<string, string> = {
  'visa': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#1434CB"/><path d="M489.823 143.111C442.988 143.111 401.134 167.393 401.134 212.256C401.134 263.706 475.364 267.259 475.364 293.106C475.364 303.989 462.895 313.731 441.6 313.731C411.377 313.731 388.789 300.119 388.789 300.119L379.123 345.391C379.123 345.391 405.145 356.889 439.692 356.889C490.898 356.889 531.19 331.415 531.19 285.784C531.19 231.419 456.652 227.971 456.652 203.981C456.652 195.455 466.887 186.114 488.122 186.114C512.081 186.114 531.628 196.014 531.628 196.014L541.087 152.289C541.087 152.289 519.818 143.111 489.823 143.111ZM61.3294 146.411L60.1953 153.011C60.1953 153.011 79.8988 156.618 97.645 163.814C120.495 172.064 122.122 176.868 125.971 191.786L167.905 353.486H224.118L310.719 146.411H254.635L198.989 287.202L176.282 167.861C174.199 154.203 163.651 146.411 150.74 146.411H61.3294ZM333.271 146.411L289.275 353.486H342.756L386.598 146.411H333.271ZM631.554 146.411C618.658 146.411 611.825 153.318 606.811 165.386L528.458 353.486H584.542L595.393 322.136H663.72L670.318 353.486H719.805L676.633 146.411H631.554ZM638.848 202.356L655.473 280.061H610.935L638.848 202.356Z" fill="white"/></svg>',
  'mastercard': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#000"/><path d="M465.7 69.1H314.2v273h151.6z" fill="#FF5A00"/><path d="M323.9 205.6c0-55.5 26.1-104.7 66.1-136.5A189.6 189.6 0 00282.9 32C186.9 32 109.3 109.6 109.3 205.6s77.6 173.6 173.6 173.6c40.5 0 77.6-14 107.1-37.1a189.6 189.6 0 01-66.1-136.5z" fill="#EB001B"/><path d="M670.7 205.6c0 96-77.6 173.6-173.6 173.6-40.5 0-77.6-14-107-37.1a189.6 189.6 0 000-273.1c29.4-23.1 66.5-37.1 107-37.1 96 0 173.6 77.6 173.6 173.6z" fill="#F79E1B"/></svg>',
  'amex': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#006FCF"/><text x="390" y="320" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="190" fill="white" letter-spacing="10">AMEX</text></svg>',
  'paypal': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><path d="M168.4 169.9c-8.4-5.8-19.4-8.7-32.9-8.7H83.2c-4.1 0-6.4 2.1-6.9 6.2L55 300.9c-.2 1.3.1 2.5 1 3.6s2 1.6 3.3 1.6h24.9c4.4 0 6.8-2.1 7.2-6.2l5.9-36c.2-1.7 1-3.2 2.3-4.3 1.3-1.1 2.9-1.8 4.9-2.1 2-.3 3.8-.5 5.6-.5s3.8.1 6.2.3c2.4.2 3.9.3 4.6.3 18.8 0 33.5-5.3 44.2-15.9 10.7-10.6 16-25.2 16-44 0-12.9-4.2-22.2-12.6-28zm-27 40.1c-1.1 7.6-3.9 12.6-8.5 15s-11.1 3.6-19.6 3.6l-10.8.3 5.6-35c.4-2.4 1.9-3.6 4.3-3.6h6.2c8.7 0 15 1.3 19 3.8 3.9 2.5 5.2 7.8 3.9 15.9z" fill="#003087"/><path d="M540 169.9c-8.4-5.8-19.4-8.7-32.9-8.7h-52c-4.4 0-6.8 2.1-7.2 6.2l-21.3 133.5c-.2 1.3.1 2.5 1 3.6s2 1.6 3.3 1.6h26.8c2.6 0 4.4-1.4 5.2-4.3l5.9-37.9c.2-1.7 1-3.2 2.3-4.3 1.3-1.1 2.9-1.8 4.9-2.1 2-.3 3.8-.5 5.6-.5s3.8.1 6.2.3c2.4.2 3.9.3 4.6.3 18.8 0 33.5-5.3 44.2-15.9 10.7-10.6 16-25.2 16-44 0-12.9-4.2-22.2-12.6-28zm-33.5 53.8c-4.8 3.3-12 4.9-21.6 4.9l-10.5.3 5.6-35c.4-2.4 1.8-3.6 4.3-3.6h5.9c4.8 0 8.6.2 11.5.7 2.8.4 5.6 1.8 8.2 4.1 2.6 2.3 3.9 5.6 3.9 10 0 9.2-2.4 15.4-7.2 18.6z" fill="#009CDE"/><path d="M291.2 209.3h-24.9c-3.1 0-4.9 3.6-5.6 10.8-5.9-8.7-16.2-13.1-31.1-13.1-15.7 0-29.1 5.9-40.1 17.7-11 11.8-16.5 25.6-16.5 41.6 0 12.9 3.8 23.1 11.3 30.7 7.5 7.6 17.6 11.5 30.3 11.5 6.3 0 12.8-1.3 19.3-3.9 6.5-2.6 11.8-6.1 15.7-10.5-.9 2.6-1.3 4.9-1.3 6.9 0 3.5 1.4 5.2 4.3 5.2h22.6c4.1 0 6.5-2.1 7.2-6.2l13.4-85.4c.2-1.3-.1-2.5-1-3.6s-2-1.6-3.3-1.6zm-42.7 64.6c-5.6 5.4-12.4 8-20.4 8-6.3 0-11.4-1.7-15.2-5.2-3.8-3.5-5.7-8.3-5.7-14.4 0-8.1 2.7-14.9 8.2-20.4 5.4-5.6 12.2-8.3 20.3-8.3 6.1 0 11.2 1.8 15.2 5.4s6.1 8.6 6.1 14.9c0 8.1-2.8 14.8-8.3 20.1z" fill="#003087"/><path d="M662.9 209.3h-24.9c-3.1 0-4.9 3.6-5.6 10.8-5.7-8.7-16-13.1-31.1-13.1-15.7 0-29.1 5.9-40.1 17.7-11 11.8-16.5 25.6-16.5 41.6 0 12.9 3.8 23.1 11.3 30.7 7.5 7.6 17.6 11.5 30.3 11.5 6.3 0 12.8-1.3 19.3-3.9 6.5-2.6 11.7-6.1 15.4-10.5 0 .2-.2 1.2-.7 2.9-.4 1.7-.7 3.1-.7 3.9 0 3.5 1.4 5.2 4.3 5.2h22.6c4.1 0 6.5-2.1 7.2-6.2l13.4-85.4c.2-1.3-.1-2.5-1-3.6s-2-1.6-3.3-1.6zm-42.7 64.5c-5.6 5.5-12.3 8.2-20.1 8.2-6.3 0-11.4-1.7-15.4-5.2-3.9-3.5-5.9-8.3-5.9-14.4 0-8.1 2.7-14.9 8.2-20.4 5.4-5.6 12.2-8.3 20.3-8.3 6.1 0 11.2 1.8 15.2 5.4 4 3.6 6.1 8.6 6.1 14.9 0 7.9-2.8 14.5-8.3 20z" fill="#009CDE"/><path d="M428.3 213.9c0-1.1-.4-2.1-1.3-3.1s-1.9-1.5-2.9-1.5h-25.2c-2.4 0-4.4 1.1-5.9 3.3l-34.7 51-14.4-49.1c-1.1-3.5-3.5-5.2-7.2-5.2h-24.5c-1.1 0-2.1.5-2.9 1.5s-1.3 2-1.3 3.1c0 .4 2.1 6.9 6.4 19.3 4.3 12.4 8.8 25.8 13.7 40.2 4.9 14.4 7.5 22 7.7 22.9-17.9 24.4-26.8 37.5-26.8 39.3 0 2.8 1.4 4.3 4.3 4.3h25.2c2.4 0 4.4-1.1 5.9-3.3l83.4-120.4c.4-.4.7-1.2.7-2.3z" fill="#003087"/><path d="M720.8 161.2h-24.2c-2.4 0-3.8 1.2-4.3 3.6l-21.3 136.1-.3.7c0 1.1.4 2.1 1.3 3.1s2 1.5 3.3 1.5h21.6c4.1 0 6.4-2.1 6.9-6.2l21.3-133.8v-.3c0-3.1-1.4-4.6-4.3-4.6z" fill="#009CDE"/></svg>',
  'discover': '<?xml encoding="UTF-8"?><svg width="38" height="24" viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M54.992 0C24.627 0 0 24.63 0 55.004v390.992C0 476.376 24.619 501 54.992 501h670.016C755.373 501 780 476.37 780 445.996V55.004C780 24.624 755.381 0 725.008 0H54.992z" fill="#4D4D4D"/><path d="M327.152 161.893c8.837 0 16.248 1.784 25.268 6.09v22.751c-8.544-7.863-15.955-11.154-25.756-11.154-19.264 0-34.414 15.015-34.414 34.05 0 20.075 14.681 34.196 35.37 34.196 9.312 0 16.586-3.12 24.8-10.857v22.763c-9.341 4.14-16.911 5.776-25.756 5.776-31.278 0-55.582-22.596-55.582-51.737 0-28.826 24.951-51.878 56.07-51.878zm-97.113.627c11.546 0 22.11 3.72 30.943 10.994l-10.748 13.248c-5.35-5.646-10.41-8.028-16.564-8.028-8.853 0-15.3 4.745-15.3 10.989 0 5.354 3.619 8.188 15.944 12.482 23.365 8.044 30.29 15.176 30.29 30.926 0 19.193-14.976 32.553-36.32 32.553-15.63 0-26.994-5.795-36.458-18.872l13.268-12.03c4.73 8.61 12.622 13.222 22.42 13.222 9.163 0 15.947-5.952 15.947-13.984 0-4.164-2.055-7.734-6.158-10.258-2.066-1.195-6.158-2.977-14.2-5.647-19.291-6.538-25.91-13.527-25.91-27.185 0-16.225 14.214-28.41 32.846-28.41zm234.723 1.728h22.437l28.084 66.592 28.446-66.592h22.267l-45.494 101.686h-11.053l-44.687-101.686zm-397.348.152h30.15c33.312 0 56.534 20.382 56.534 49.641 0 14.59-7.104 28.696-19.118 38.057-10.108 7.901-21.626 11.445-37.574 11.445H67.414V164.4zm96.135 0h20.54v99.143h-20.54V164.4zm411.734 0h58.252v16.8H595.81v22.005h36.336v16.791h-36.336v26.762h37.726v16.785h-58.252V164.4zm71.858 0h30.455c23.69 0 37.265 10.71 37.265 29.272 0 15.18-8.514 25.14-23.986 28.105l33.148 41.766h-25.26l-28.429-39.828h-2.678v39.828h-20.515V164.4zm20.515 15.616v30.025h6.002c13.117 0 20.069-5.362 20.069-15.328 0-9.648-6.954-14.697-19.745-14.697h-6.326zM87.94 181.199v65.559h5.512c13.273 0 21.656-2.394 28.11-7.88 7.103-5.955 11.376-15.465 11.376-24.98 0-9.499-4.273-18.725-11.376-24.681-6.785-5.78-14.837-8.018-28.11-8.018H87.94z" fill="#FFF"/><path d="m415.13 161.21c30.941 0 56.022 23.58 56.022 52.709v0.033c0 29.13-25.081 52.742-56.021 52.742s-56.022-23.613-56.022-52.742v-0.033c0-29.13 25.082-52.71 56.022-52.71zm364.85 127.15c-26.05 18.33-221.08 149.34-558.75 212.62h503.76c30.365 0 54.992-24.63 54.992-55.004v-157.62z" fill="#F47216"/></g></svg>',
  'jcb': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#0E4C96"/><path d="M632.2 361.3c0 41.6-33.7 75.4-75.4 75.4H147.7V138.8c0-41.6 33.7-75.4 75.4-75.4h409.1v297.9z" fill="#fff"/><path d="M498.9 256.5c11.7.3 23.4-.5 35.1.4 11.8 2.2 14.6 20 4.2 25.9-7.1 3.9-15.6 1.4-23.4 2.1h-15.9v-28.4zm41.8-32.1c2.6 9.2-6.2 17.4-15.1 16.1h-26.8c.2-8.6-.4-18 .3-26.2 10.7.3 21.5-.6 32.2.5 4.6 1.1 8.4 4.9 9.4 9.6z" fill="#007B40"/><path d="M605.1 88.5c.5 17.5.1 35.9.2 53.8v217.8c-.5 27.2-24.6 50.8-51.6 51.4H524V301.8c29.5-.2 59 .3 88.4-.2 13.7-.9 28.6-9.9 29.3-24.9 1.6-15.1-12.6-25.6-26.2-27.2-5.2-.1-5-1.5 0-2.1 12.9-2.8 23-16.1 19.2-29.5-3.2-14.1-18.8-19.5-31.7-19.5-26.4-.2-52.7 0-79.1-.1.2-20.5-.4-41 .3-61.5 2.1-26.7 26.8-48.7 53.4-48.3h78.9z" fill="#007B40"/><path d="M174.7 139.5c.7-27.2 24.9-50.6 51.9-51h80.8v272.7c-1 26.8-25 49.8-51.7 50.3H174.7V298c26.2 6.2 53.7 8.8 80.5 4.7 16-2.6 33.5-10.4 38.9-27 4-14.2 1.7-29.1 2.3-43.7v-33.8h-46.3c-.2 22.4.4 44.8-.3 67.1-1.2 13.7-14.8 22.5-27.8 22-16.1.2-47.9-11.6-47.9-11.6V139.5z" fill="#1D2970"/><path d="M324.7 211.9c-2.4.5-.5-8.3-1.1-11.6.2-21.2-.3-42.3.3-63.5 2.1-26.8 27-48.9 53.7-48.3h78.8v272.7c-1 26.8-25 49.8-51.7 50.3H324v-124.3c18.4 15.1 43.5 17.5 66.5 17.5 17.3 0 34.5-2.7 51.3-6.7V275c-19 9.4-41.2 15.4-62.2 10-14.7-3.7-25.3-17.8-25.1-32.9-1.7-15.7 7.5-32.3 23-37 19.2-6 40.1-1.4 58.1 6.4 3.9 2 7.8 4.5 6.2-1.9v-17.9c-30.1-7.2-62.1-9.8-92.3-2-8.7 2.5-17.3 6.2-24.4 12z" fill="#E30138"/></svg>',
  'diners': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#0079BE"/><path d="M599.9 251.4c0-99.4-83-168.1-173.9-168.1h-78.2c-92 0-167.7 68.7-167.7 168.1 0 90.9 75.7 165.6 167.7 165.2h78.2c90.9.4 173.9-74.3 173.9-165.2z" fill="#fff"/><path d="M348.3 97.4c-84.1 0-152.2 68.3-152.2 152.6 0 84.3 68.1 152.5 152.2 152.6 84.1 0 152.2-68.3 152.2-152.6 0-84.3-68.1-152.6-152.2-152.6z" fill="#0079BE"/><path d="M252.1 249.6c.1-41.2 25.7-76.3 61.9-90.3v180.5c-36.2-13.9-61.9-49-61.9-90.2zm131 90.3V159.4c36.2 13.9 61.9 49 62 90.3-.1 41.2-25.8 76.3-62 90.3z" fill="#fff"/></svg>',
  'unionpay': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><path d="M216.4 69.8h142.4c19.9 0 32.3 16.4 27.6 36.5l-66.3 287.5c-4.7 20.1-24.6 36.5-44.5 36.5H133.2c-19.9 0-32.3-16.4-27.6-36.5L172 106.3c4.7-20.2 24.5-36.5 44.4-36.5z" fill="#D10429"/><path d="M346.3 69.8h163.8c19.9 0 10.9 16.4 6.2 36.5l-66.3 287.5c-4.7 20.1-3.2 36.5-23.1 36.5H263.1c-20 0-32.3-16.4-27.5-36.5l66.3-287.5c4.7-20.2 24.5-36.5 44.5-36.5z" fill="#022E64"/><path d="M504.4 69.8h142.4c19.9 0 32.3 16.4 27.6 36.5l-66.3 287.5c-4.7 20.1-24.6 36.5-44.5 36.5H421.2c-20 0-32.3-16.4-27.6-36.5l66.3-287.5c4.7-20.2 24.5-36.5 44.4-36.5z" fill="#076F74"/></svg>',
  'maestro': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#000"/><path d="M465.8 69H314.2v273h151.6z" fill="#7673C0"/><path d="M323.8 205.3c0-55.5 26.1-104.7 66.1-136.5-29.4-23.1-66.5-37.1-107.1-37.1C186.9 32 109.3 109.6 109.3 205.6s77.6 173.6 173.6 173.6c40.5 0 77.6-14 107.1-37.1-40-31.8-66.1-81-66.1-136.5z" fill="#EB001B"/><path d="M670.2 205.3c0 96-77.6 173.6-173.6 173.6-40.5 0-77.6-14-107-37.1 40-31.8 66.1-81 66.1-136.5s-26.1-104.7-66.1-136.5c29.4-23.1 66.5-37.1 107-37.1 96 0 173.6 77.6 173.6 173.6z" fill="#00A1DF"/></svg>',
  'apple-pay': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#000"/><g transform="translate(55,82) scale(14)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="white"/></g><text x="400" y="250" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-weight="300" font-size="180" dominant-baseline="central" fill="white">Pay</text></svg>',
  'google-pay': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><g transform="translate(126,-14) scale(22)"><path d="M3.963 7.235A3.963 3.963 0 00.422 9.419a3.963 3.963 0 000 3.559 3.963 3.963 0 003.541 2.184c1.07 0 1.97-.352 2.627-.957.748-.69 1.18-1.71 1.18-2.916a4.722 4.722 0 00-.07-.806H3.964v1.526h2.14a1.835 1.835 0 01-.79 1.205c-.356.241-.814.379-1.35.379-1.034 0-1.911-.697-2.225-1.636a2.375 2.375 0 010-1.517c.314-.94 1.191-1.636 2.225-1.636a2.152 2.152 0 011.52.594l1.132-1.13a3.808 3.808 0 00-2.652-1.033zm6.501.55v6.9h.886V11.89h1.465c.603 0 1.11-.196 1.522-.588a1.911 1.911 0 00.635-1.464 1.92 1.92 0 00-.635-1.456 2.125 2.125 0 00-1.522-.598zm2.427.85a1.156 1.156 0 01.823.365 1.176 1.176 0 010 1.686 1.171 1.171 0 01-.877.357H11.35V8.635h1.487a1.156 1.156 0 01.054 0zm4.124 1.175c-.842 0-1.477.308-1.907.925l.781.491c.288-.417.68-.626 1.175-.626a1.255 1.255 0 01.856.323 1.009 1.009 0 01.366.785v.202c-.34-.193-.774-.289-1.3-.289-.617 0-1.11.145-1.479.434-.37.288-.554.677-.554 1.165a1.476 1.476 0 00.525 1.156c.35.308.785.463 1.305.463.61 0 1.098-.27 1.465-.81h.038v.655h.848v-2.909c0-.61-.19-1.09-.568-1.44-.38-.35-.896-.525-1.551-.525zm2.263.154l1.946 4.422-1.098 2.38h.915L24 9.963h-.965l-1.368 3.391h-.02l-1.406-3.39zm-2.146 2.368c.494 0 .88.11 1.156.33 0 .372-.147.696-.44.973a1.413 1.413 0 01-.997.414 1.081 1.081 0 01-.69-.232.708.708 0 01-.293-.578c0-.257.12-.47.363-.647.24-.173.54-.26.9-.26Z" fill="#5f6368"/></g></svg>',
  'shop-pay': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#5A31F4"/><g transform="translate(174,34) scale(18)"><path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" fill="white"/></g></svg>',
  'klarna': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#FFB3C7"/><g transform="translate(150,30) scale(20)"><path d="M4.592 2v20H0V2h4.592zm11.46 0c0 4.194-1.583 8.105-4.415 11.068l-.278.283L17.702 22h-5.668l-6.893-9.4 1.779-1.332c2.858-2.14 4.535-5.378 4.637-8.924L11.562 2h4.49zM21.5 17a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" fill="#0A0B09"/></g></svg>',
  'afterpay': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#B2FCE4"/><g transform="translate(150,30) scale(20)"><path d="M12 0C5.373 0 0 5.373 0 12c0 6.628 5.373 12 12 12 6.628 0 12-5.372 12-12 0-6.627-5.372-12-12-12Zm1.236 4.924a2.21 2.21 0 0 1 1.15.299l4.457 2.557c1.495.857 1.495 3.013 0 3.87l-4.457 2.558c-1.488.854-3.342-.22-3.342-1.935v-.34a.441.441 0 0 0-.66-.383L6.287 13.9a.441.441 0 0 0 0 .765l4.096 2.35a.44.44 0 0 0 .661-.382v-.685c0-.333.36-.542.649-.376l1.041.597a.441.441 0 0 1 .222.383v.29c0 1.715-1.854 2.789-3.342 1.935L5.157 16.22c-1.495-.857-1.495-3.013 0-3.87l4.457-2.558c1.488-.854 3.342.22 3.342 1.935v.34c0 .34.366.551.66.383l4.097-2.35a.441.441 0 0 0 0-.765l-4.096-2.351a.441.441 0 0 0-.661.382v.685c0 .333-.36.541-.649.375l-1.041-.597a.442.442 0 0 1-.222-.383v-.29c0-1.285 1.043-2.21 2.192-2.233z" fill="#000"/></g></svg>',
  'stripe': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#635BFF"/><g transform="translate(150,30) scale(20)"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" fill="white"/></g></svg>',
  'venmo': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#008CFF"/><g transform="translate(222,82) scale(14)"><path d="M21.772 13.119c-.267 0-.381-.251-.38-.655 0-.533.121-1.575.712-1.575.267 0 .357.243.357.598 0 .533-.13 1.632-.689 1.632Zm.502-3.377c-1.677 0-2.405 1.285-2.405 2.658 0 1.042.421 1.874 1.693 1.874 1.717 0 2.438-1.406 2.438-2.763 0-1.025-.462-1.769-1.726-1.769Zm-3.833 0c-.558 0-.964.17-1.393.477-.154-.275-.462-.477-.932-.477-.542 0-.947.219-1.247.437l-.04-.364H13.54l-.688 4.354h1.506l.479-3.053c.129-.065.323-.154.518-.154.145 0 .267.049.267.267 0 .056-.016.145-.024.218l-.429 2.722h1.498l.478-3.053c.138-.073.324-.154.51-.154.146 0 .268.049.268.267 0 .056-.017.145-.025.218l-.429 2.722h1.499l.461-2.908c.025-.153.049-.388.049-.549 0-.582-.267-.97-1.037-.97Zm-6.871 0c-.575 0-.98.219-1.287.421l-.017-.348H8.962l-.689 4.354H9.78l.478-3.053c.13-.065.324-.154.518-.154.147 0 .268.049.268.242 0 .081-.024.227-.032.299l-.422 2.666h1.499l.462-2.908c.024-.153.049-.388.049-.549 0-.582-.268-.97-1.03-.97Zm-5.631 1.834c.041-.485.413-.824.697-.824.162 0 .299.097.299.291 0 .404-.713.533-.996.533Zm.843-1.834c-1.604 0-2.382 1.39-2.382 2.698 0 1.01.478 1.817 1.814 1.817.527 0 1.07-.113 1.418-.282l.186-1.26c-.494.25-.874.347-1.271.347-.365 0-.64-.194-.64-.687.826-.008 2.252-.347 2.252-1.453 0-.687-.494-1.18-1.377-1.18Zm-4.239.267c.089.186.146.412.146.743 0 .606-.429 1.494-.777 2.06l-.373-2.989L0 9.969l.705 4.2h1.757c.77-1.01 1.718-2.448 1.718-3.554 0-.347-.073-.622-.235-.889l-1.402.283Z" fill="#fff"/></g></svg>',
  'cashapp': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#00D632"/><g transform="translate(222,82) scale(14)"><path d="M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z" fill="#fff"/></g></svg>',
  'bitcoin': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#F7931A"/><g transform="translate(222,82) scale(14)"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" fill="#fff"/></g></svg>',
  'wechat-pay': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#07C160"/><g transform="translate(222,82) scale(14)"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" fill="#fff"/></g></svg>',
  'alipay': '<svg viewBox="0 0 780 500" width="38" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#1677FF"/><path d="M114.3 258c-4.8.6-13.2 2.4-18 6.6C82.8 277.2 90.3 299.4 119.7 299.4c16.8 0 33.6-10.8 46.8-27.6-19.2-9-34.8-15.6-52.2-13.8z" fill="#fff"/><path d="M221.8 273.4c27 9 33 9.6 33 9.6v-96c0-16.2-13.2-29.4-30-29.4H98.8c-16.2 0-30 13.2-30 29.4v126c0 16.2 13.2 29.4 30 29.4h126c16.2 0 30-13.2 30-29.4v-1.2s-48-19.8-72.6-31.8c-16.2 19.8-37.2 32.4-59.4 32.4-37.2 0-49.8-32.4-31.8-53.4 3.6-4.8 10.2-9 20.4-11.4 15.6-3.6 40.8 2.4 64.2 10.2 4.2-7.8 7.8-16.2 10.2-25.2h-72.6v-7.2h37.2v-14.4h-45.6v-7.2h45.6v-18.6s0-3 3-3h18v22.2h45v6.6h-45v13.2h36.6c-3.6 14.4-9 27.6-15.6 39 12 4.2 22.2 7.8 29.4 10.2z" fill="#fff"/></svg>',
};

/** Staging hint tells the preview what scenario to show based on what the user is editing */
export interface StagingHint {
  /** 'tier' = editing a specific tier, 'allUnlocked' = editing the "all rewards" text, null = default */
  context: 'tier' | 'allUnlocked' | null;
  /** Which tier is being edited (index in sorted tiers array) */
  tierIndex?: number;
  /** 'before' = show cart NOT yet reaching this tier, 'after' = show cart REACHING this tier, 'gift' = same as after */
  field?: 'before' | 'after' | 'gift' | 'label' | 'goal';
}

interface PreviewProduct {
  title: string;
  image: string;
  variant: string;
  price: string;
  compareAtPrice: string | null;
}

interface AddonPreviewProps {
  addonKey: string;
  addonConfig: Record<string, any>;
  mode: 'focused' | 'full';
  themeSettings?: Record<string, any>;
  /** Controls what the preview "stages" to show based on what the user is currently editing */
  stagingHint?: StagingHint | null;
  /** Store ID to fetch real products for preview */
  storeId?: string | null;
}

function buildTrustBadgesHtml(config: Record<string, any> | undefined): string {
  const c = config ?? {};
  // Default must match addon-definitions.ts dim.default + v14-complete.js injectTrustBadges
  const icons: string[] = c.icons || ['visa', 'mastercard', 'amex', 'discover', 'paypal', 'apple-pay', 'google-pay'];

  const iconEntries = icons.map((id: string) => {
    const svg = PAYMENT_SVGS[id] || '';
    return svg;
  }).join('');

  return '<div id="ccd-trust-badges" class="ccd-trust-badges">' +
    '<div class="ccd-trust-icons" style="gap:6px">' + iconEntries + '</div>' +
    '</div>';
}

export default function AddonPreview({ addonKey, addonConfig, mode, themeSettings, stagingHint, storeId }: AddonPreviewProps) {
  const [iframeHeight, setIframeHeight] = useState(mode === 'full' ? 680 : (FOCUS_AREAS[addonKey]?.height || 200));
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  // Live addon configs for all OTHER enabled addons — so the preview shows the
  // full storefront cart, not just the focused addon. The focused addon stays
  // inline (live-edits without a fetch round-trip).
  const [liveAddons, setLiveAddons] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/stores/${storeId}/products/preview?_t=${Date.now()}`)
      .then(r => r.json())
      .then(data => { if (data.products?.length) setPreviewProducts(data.products); })
      .catch(() => {});
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/stores/${storeId}/addons?target=demo&_t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        // API returns either { addons: {...} } or the map directly.
        const map = data?.addons ?? data;
        if (map && typeof map === 'object') setLiveAddons(map);
      })
      .catch(() => {});
  }, [storeId]);

  let cartHtml = CONTROL_HTML.replace(/\r\n/g, '\n');
  cartHtml = cartHtml.replace('class="custom-cart-drawer"', 'class="custom-cart-drawer drawer--right drawer--is-open"');

  // ── Apply live theme settings to match real cart ──────────────────
  if (themeSettings) {
    const m1 = themeSettings.ccd_milestone1_label || 'Free shipping';
    const m2 = themeSettings.ccd_milestone2_label || '2+1 FREE';
    const checkoutText = themeSettings.ccd_checkout_text || 'SECURE CHECKOUT';
    cartHtml = cartHtml.replace('>Free shipping</span>', '>' + m1 + '</span>');
    cartHtml = cartHtml.replace('>2+1 FREE</span>', '>' + m2 + '</span>');
    cartHtml = cartHtml.replace('SECURE CHECKOUT', checkoutText);
  }

  // ── Replace placeholder products with real store products ──────────
  if (previewProducts.length >= 2) {
    const imgPlaceholder = '<svg width="40" height="40" viewBox="0 0 24 24" fill="#ccc"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
    const buildItemHtml = (p: PreviewProduct) => {
      const imgHtml = p.image
        ? `<a href="#"><img src="${p.image}" alt="${p.title}" style="width:100%;height:auto;display:block;object-fit:cover"></a>`
        : `<a href="#"><div style="width:120px;height:120px;background:#f0f0f0;display:flex;align-items:center;justify-content:center">${imgPlaceholder}</div></a>`;
      const variantHtml = p.variant ? `<div class="ccd-item__variant">${p.variant}</div>` : '';
      const priceHtml = p.compareAtPrice
        ? `<span class="ccd-item__compare-price">$${p.compareAtPrice}</span><span class="ccd-item__price">$${p.price}</span>`
        : `<span class="ccd-item__price">$${p.price}</span>`;
      return `<div class="ccd-item">
            <div class="ccd-item__image">${imgHtml}</div>
            <div class="ccd-item__details">
              <div class="ccd-item__title-row">
                <a href="#" class="ccd-item__name">${p.title}</a>
                <button type="button" class="ccd-item__remove" aria-label="Remove">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                </button>
              </div>
              ${variantHtml}
              <div class="ccd-item__bottom">
                <div class="ccd-qty">
                  <button type="button" class="ccd-qty__btn ccd-qty__btn--minus"><svg viewBox="0 0 20 20"><path d="M17.543 11.029H2.1A1.032 1.032 0 0 1 1.071 10c0-.566.463-1.029 1.029-1.029h15.443c.566 0 1.029.463 1.029 1.029 0 .566-.463 1.029-1.029 1.029z"></path></svg></button>
                  <input type="text" class="ccd-qty__input" value="1" aria-label="Quantity">
                  <button type="button" class="ccd-qty__btn ccd-qty__btn--plus"><svg viewBox="0 0 20 20"><path d="M17.409 8.929h-6.695V2.258c0-.566-.506-1.029-1.071-1.029s-1.071.463-1.071 1.029v6.671H1.967C1.401 8.929.938 9.435.938 10s.463 1.071 1.029 1.071h6.605V17.7c0 .566.506 1.029 1.071 1.029s1.071-.463 1.071-1.029v-6.629h6.695c.566 0 1.029-.506 1.029-1.071s-.463-1.071-1.029-1.071z"></path></svg></button>
                </div>
                <div class="ccd-item__price-col">
                  <div class="ccd-item__price-row">${priceHtml}</div>
                </div>
              </div>
            </div>
          </div>`;
    };
    const itemsHtml = previewProducts.slice(0, 2).map(p => buildItemHtml(p)).join('\n');
    const startMarker = '<!-- CART_ITEMS_START -->';
    const endMarker = '<!-- CART_ITEMS_END -->';
    const startIdx = cartHtml.indexOf(startMarker);
    const endIdx = cartHtml.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1) {
      cartHtml = cartHtml.substring(0, startIdx + startMarker.length) + itemsHtml + cartHtml.substring(endIdx);
    }

    // Recalculate checkout total and discount to match real preview products
    if (addonKey !== 'shippingProtection') {
      const productsTotal = previewProducts.slice(0, 2).reduce((sum, p) => sum + parseFloat(p.price), 0);
      const hasDiscount = previewProducts.slice(0, 2).some(p => p.compareAtPrice);
      const checkoutVal = productsTotal + 4.99; // default protection price
      cartHtml = cartHtml.replace(
        /(<span class="ccd-checkout-total">)\$[\d.]+(<\/span>)/,
        '$1$' + checkoutVal.toFixed(2) + '$2'
      );
      if (!hasDiscount) {
        cartHtml = cartHtml.replace(
          /(<div class="ccd-discount-row"[^>]*style=")[^"]*(")/,
          '$1display:none$2'
        );
      } else {
        let discountAmt = 0;
        for (const p of previewProducts.slice(0, 2)) {
          if (p.compareAtPrice) discountAmt += parseFloat(p.compareAtPrice) - parseFloat(p.price);
        }
        if (discountAmt > 0) {
          cartHtml = cartHtml.replace(
            /(<span class="ccd-discount-row__amount">)-?\$[\d.]+(<\/span>)/,
            '$1-$' + discountAmt.toFixed(2) + '$2'
          );
        }
      }
    }
  }

  // ── Background addons: render every OTHER enabled addon so the preview
  //    matches the live storefront cart. The focused addon (addonKey) is
  //    skipped here and rendered by its dedicated inline block below — that
  //    block reads `addonConfig` from props so live-edits update instantly
  //    without re-fetching /addons.
  //
  //    Order mirrors v14-complete.js and preview-renderer.ts:
  //      freeShippingBar → shippingProtection → trustBadges → scarcityTimer
  //      → lowStockBadge → upsellRecommendations → socialProof → expressPayments
  if (liveAddons) {
    const getEntry = (k: string): { enabled: boolean; config: Record<string, any> } => {
      const raw = liveAddons[k];
      if (!raw) return { enabled: false, config: {} };
      // API shape: { enabled, config }. Legacy: flat object.
      if (typeof raw === 'object' && ('enabled' in raw || 'config' in raw)) {
        return { enabled: raw.enabled !== false, config: raw.config || {} };
      }
      return { enabled: true, config: raw as Record<string, any> };
    };
    const productsForFsb = previewProducts.length
      ? previewProducts.map(p => ({
          title: p.title,
          image: p.image,
          variant: p.variant,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
        }))
      : undefined;

    const ORDER: Array<{ key: string; apply: (h: string, c: Record<string, any>) => string }> = [
      { key: 'freeShippingBar',        apply: (h, c) => applyFreeShippingBar(h, c, { previewProducts: productsForFsb }) },
      { key: 'shippingProtection',     apply: (h, c) => applyShippingProtection(h, c) },
      { key: 'trustBadges',            apply: (h, c) => applyTrustBadges(h, c) },
      { key: 'scarcityTimer',          apply: (h, c) => applyScarcityTimer(h, c) },
      { key: 'lowStockBadge',          apply: (h, c) => applyLowStockBadge(h, c) },
      { key: 'upsellRecommendations',  apply: (h, c) => applyUpsellRecommendations(h, c, { previewProducts: productsForFsb }) },
      { key: 'socialProof',            apply: (h, c) => applySocialProof(h, c, { deterministic: true }) },
      { key: 'expressPayments',        apply: (h, c) => applyExpressPayments(h, c) },
      { key: 'notes',                  apply: (h, c) => applyNotes(h, c) },
      { key: 'customCode',             apply: (h, c) => applyCustomCode(h, c) },
      { key: 'discountCode',           apply: (h, c) => applyDiscountCode(h, c) },
      { key: 'termsCheckbox',          apply: (h, c) => applyTermsCheckbox(h, c) },
    ];

    for (const { key, apply } of ORDER) {
      if (key === addonKey) continue; // focused addon rendered below
      const entry = getEntry(key);
      if (!entry.enabled) continue;
      try {
        cartHtml = apply(cartHtml, entry.config);
      } catch {
        // Skip a failing transform — never block the preview render.
      }
    }
  }

  // Always strip the trust badge placeholder if trustBadges isn't going to
  // inject it (either disabled, or focused but disabled in props).
  if (addonKey !== 'trustBadges' && (!liveAddons || liveAddons.trustBadges?.enabled === false)) {
    cartHtml = cartHtml.replace('<!-- TRUST_BADGES_PLACEHOLDER -->', '');
  }

  // ── Trust Badges: dynamic icons + text + position ──────────────────
  if (addonKey === 'trustBadges') {
    const badgesHtml = buildTrustBadgesHtml(addonConfig);
    const position = addonConfig.position || 'below-checkout';
    // Remove static placeholder
    cartHtml = cartHtml.replace('<!-- TRUST_BADGES_PLACEHOLDER -->', '');
    // Inject at chosen position
    if (position === 'above-checkout') {
      cartHtml = cartHtml.replace(
        '<button type="button" class="ccd-checkout-btn">',
        badgesHtml + '<button type="button" class="ccd-checkout-btn">'
      );
    } else if (position === 'below-items') {
      cartHtml = cartHtml.replace(
        '<div class="ccd-sticky-footer">',
        '<div class="ccd-sticky-footer">' + badgesHtml
      );
    } else {
      // below-checkout (default) — after the ccd-trust div
      cartHtml = cartHtml.replace(
        '</div>\n      <!-- TRUST_BADGES_PLACEHOLDER -->',
        '</div>' + badgesHtml
      );
      // Fallback if already removed
      if (!cartHtml.includes('ccd-trust-badges')) {
        cartHtml = cartHtml.replace(
          /<\/div>\s*<\/div>\s*<\/form>/,
          '</div>' + badgesHtml + '</div></form>'
        );
      }
    }
  }

  // ── Scarcity Timer: rich text (alignment lives inside HTML) + duration + position ────
  if (addonKey === 'scarcityTimer') {
    // Migrate from legacy fields if present.
    // normalizeBlockColorWrap fixes the broken <span color><div>...</div></span> pattern from older
    // save logic — HTML5 auto-closes the span around the block, which silently drops the color.
    const rawTextRaw = addonConfig.text != null
      ? String(addonConfig.text)
      : '<span style="color:#d32f2f">Your cart is reserved for <strong>{time}</strong></span>';
    // 1) Migrate the legacy <span color><div></div></span> broken pattern (HTML5 auto-close).
    // 2) Apply default red if the saved HTML has no foreground color at all — without this, the
    //    preview iframe's CSS (#CartDrawer.custom-cart-drawer { color:#111 }) makes the timer black.
    const themeColor = typeof addonConfig.themeColor === 'string' ? addonConfig.themeColor : '#d32f2f';
    const rawText = applyDefaultColor(normalizeBlockColorWrap(rawTextRaw), themeColor);
    const durationRaw = addonConfig.duration;
    const durationMin = typeof durationRaw === 'number'
      ? durationRaw
      : (Number(durationRaw) || 10);
    const safeDuration = Math.max(1, Math.min(60, durationMin));
    const position = addonConfig.position || 'below-header';

    // Visual styling (background, text color, font size, font weight, padding,
    // border radius) is controlled inline via the rich text editor toolbar in
    // rawText — no separate fields. Only pulse animation is a wrapper-level toggle.
    const pulseAnimation = addonConfig.pulseAnimation !== false;

    // Render preview at the START of the countdown (mm:ss).
    // Alignment lives inside rawText (text-align inline styles set via the rich text editor).
    const mm = String(safeDuration).padStart(2, '0');
    const timeDisplay = mm + ':00';
    const timerInner = rawText.replace(/\{time\}/g, '<span class="ccd-scarcity-time">' + timeDisplay + '</span>');

    // NOTE: NOT using .ccd-scarcity-badge class — that class has !important rules
    // that override inline styles and is reserved for the per-item "only X left" badge.
    // All visuals come from inline styles driven by the dashboard config.
    const timerStyle =
      'display:block;width:auto;box-sizing:border-box;' +
      'padding:8px 16px;border-radius:6px;' +
      (pulseAnimation ? 'animation:ccdScarcityPulse 2s ease-in-out infinite;' : '');

    const timerHtml =
      '<div id="ccd-scarcity-timer" style="' + timerStyle + '">' +
      timerInner +
      '</div>';

    if (position === 'above-checkout') {
      cartHtml = cartHtml.replace(
        '<button type="button" class="ccd-checkout-btn">',
        timerHtml + '<button type="button" class="ccd-checkout-btn">'
      );
    } else if (position === 'floating-top') {
      cartHtml = cartHtml.replace(
        '<div class="drawer__fixed-header">',
        timerHtml + '<div class="drawer__fixed-header">'
      );
    } else {
      // below-header (default)
      cartHtml = cartHtml.replace(
        '</div>\n    </div>\n    <div class="drawer__inner"',
        '</div>' + timerHtml + '</div><div class="drawer__inner"'
      );
      if (!cartHtml.includes('ccd-scarcity-timer')) {
        cartHtml = cartHtml.replace(
          '<div class="drawer__inner"',
          timerHtml + '<div class="drawer__inner"'
        );
      }
    }
  }

  // ── Low Stock Badge — delegated to the shared applyLowStockBadge transform
  // so this focused branch stays byte-for-byte identical to the cart-editor
  // preview AND the background ORDER loop. The shared transform also handles
  // the variant-less injection case (items with no .ccd-item__variant div),
  // which the previous inline implementation missed.
  if (addonKey === 'lowStockBadge') {
    cartHtml = applyLowStockBadge(cartHtml, addonConfig);
  }

  // ── Shipping Protection: dynamic price, description, icon ─────────
  if (addonKey === 'shippingProtection') {
    const price = addonConfig.price ?? 4.99;
    const desc = addonConfig.description || 'Covers lost, stolen, or damaged packages';
    const title = addonConfig.productName || 'Shipping Protection';
    const defaultOn = addonConfig.defaultOn !== false;

    // Update icon to match selected icon
    const iconId = addonConfig.iconId || 'shield-filled';
    const iconSvg = addonConfig.customIconUrl
      ? `<img src="${addonConfig.customIconUrl}" style="width:24px;height:24px" alt="" />`
      : getProtectionIconSvg(iconId);
    // Apply icon color — set color+fill on SVG so fill:currentColor works
    const iconColor = addonConfig.iconColor || '#555555';
    const coloredIconSvg = iconSvg.includes('<svg')
      ? iconSvg.replace(/<svg/, `<svg style="color:${iconColor};fill:${iconColor}"`)
      : iconSvg; // img icons don't need color
    cartHtml = cartHtml.replace(
      /(<div class="ccd-shipping-protection__icon">)[\s\S]*?(<\/div>\s*<div class="ccd-shipping-protection__info">)/,
      '$1' + coloredIconSvg + '$2'
    );
    // Update title
    cartHtml = cartHtml.replace(
      /(<div class="ccd-shipping-protection__title">)[^<]*(<\/div>)/,
      '$1' + title + '$2'
    );
    // Update price display
    cartHtml = cartHtml.replace(
      /(<span class="ccd-shipping-protection__price">)\$[\d.]+(<\/span>)/,
      '$1$' + Number(price).toFixed(2) + '$2'
    );
    // Update description
    cartHtml = cartHtml.replace(
      /(<div class="ccd-shipping-protection__desc">)[^<]*(<\/div>)/,
      '$1' + desc + '$2'
    );
    // Update toggle state
    if (!defaultOn) {
      cartHtml = cartHtml.replace(
        '<input type="checkbox" checked>',
        '<input type="checkbox">'
      );
    }

    // Recalculate checkout total based on preview products + protection price
    let itemsTotal = 0;
    if (previewProducts.length >= 2) {
      itemsTotal = previewProducts.slice(0, 2).reduce((sum, p) => sum + parseFloat(p.price), 0);
    } else {
      // Fallback: extract from template prices
      const priceMatches = cartHtml.match(/class="ccd-item__price">\$([\d.]+)/g);
      if (priceMatches) {
        itemsTotal = priceMatches.reduce((sum, m) => {
          const n = parseFloat(m.replace(/.*\$/, ''));
          return sum + (isNaN(n) ? 0 : n);
        }, 0);
      }
    }
    const protectionCost = defaultOn ? Number(price) : 0;
    const checkoutTotal = (itemsTotal + protectionCost).toFixed(2);
    cartHtml = cartHtml.replace(
      /(<span class="ccd-checkout-total">)\$[\d.]+(<\/span>)/,
      '$1$' + checkoutTotal + '$2'
    );

    // Hide discount row if no real discounts (template has hardcoded one)
    if (previewProducts.length >= 2) {
      const hasDiscount = previewProducts.some(p => p.compareAtPrice);
      if (!hasDiscount) {
        cartHtml = cartHtml.replace(
          /(<div class="ccd-discount-row"[^>]*style=")[^"]*(")/,
          '$1display:none$2'
        );
      } else {
        // Recalculate discount from compare-at prices
        let discountAmount = 0;
        for (const p of previewProducts.slice(0, 2)) {
          if (p.compareAtPrice) {
            discountAmount += parseFloat(p.compareAtPrice) - parseFloat(p.price);
          }
        }
        if (discountAmount > 0) {
          cartHtml = cartHtml.replace(
            /(<span class="ccd-discount-row__amount">)-?\$[\d.]+(<\/span>)/,
            '$1-$' + discountAmount.toFixed(2) + '$2'
          );
        }
      }
    }
  }

  // ── Rewards (freeShippingBar): dynamic tier-based progress bar ────
  if (addonKey === 'freeShippingBar') {
    const tiers: RewardTier[] = addonConfig.tiers || [];
    const thresholdMode: string = addonConfig.thresholdMode || 'items';
    const position = addonConfig.position || 'above-items';

    // FIRST: strip the hardcoded progress bar from the base template.
    // The ccd-progress block has nested divs so we track depth to find the end.
    const progressStart = cartHtml.indexOf('<div class="ccd-progress">');
    if (progressStart !== -1) {
      let depth = 0;
      let progressEnd = -1;
      for (let i = progressStart; i < cartHtml.length; i++) {
        if (cartHtml.startsWith('<div', i)) depth++;
        if (cartHtml.startsWith('</div>', i)) {
          depth--;
          if (depth === 0) { progressEnd = i + 6; break; }
        }
      }
      if (progressEnd !== -1) {
        cartHtml = cartHtml.substring(0, progressStart) + cartHtml.substring(progressEnd);
      }
    }

    // ── Staging-aware demo cart value ──────────────────────────────────
    // Default: 2 items / $80.  When the user is editing a specific tier or
    // the "all rewards unlocked" text, we stage the cart to show the relevant
    // scenario so they get a live preview of exactly what they're editing.
    const sortedTiers = [...tiers].sort((a, b) => a.goal - b.goal);
    let demoValue = thresholdMode === 'dollars' ? 80 : 2;

    if (stagingHint?.context === 'allUnlocked' && sortedTiers.length > 0) {
      // Show all tiers completed
      demoValue = sortedTiers[sortedTiers.length - 1].goal;
    } else if (stagingHint?.context === 'tier' && stagingHint.tierIndex != null) {
      const targetTier = sortedTiers[stagingHint.tierIndex];
      if (targetTier) {
        if (stagingHint.field === 'before') {
          // Show cart NOT yet reaching this tier (1 below the goal)
          demoValue = Math.max(0, targetTier.goal - 1);
        } else {
          // 'after', 'gift', 'label', 'goal' — show cart reaching this tier
          demoValue = targetTier.goal;
        }
      }
    }

    // Find highest reached tier
    let highestReachedIdx = -1;
    for (let i = 0; i < sortedTiers.length; i++) {
      if (demoValue >= sortedTiers[i].goal) highestReachedIdx = i;
    }

    // Helper: replace {remaining} token with actual value for a tier
    const fillTemplate = (text: string, tier: RewardTier) => {
      const remaining = Math.max(0, tier.goal - demoValue);
      const remainStr = thresholdMode === 'dollars' ? `$${remaining}` : `${remaining}`;
      return text.replace(/\{remaining\}/g, remainStr);
    };

    // Next unreached tier for the top progress message
    const nextTier = sortedTiers.find(t => demoValue < t.goal);

    // ── Build the top progress message ────────────────────────────────
    // When staging for a specific tier/field, force-show THAT tier's exact
    // text so the preview matches what the user sees in the rich text editor.
    let progressMsg: string;
    const stagedTier = (stagingHint?.context === 'tier' && stagingHint.tierIndex != null)
      ? sortedTiers[stagingHint.tierIndex] : null;

    if (stagingHint?.context === 'allUnlocked' && addonConfig.allRewardsUnlockedText) {
      // Editing "all rewards unlocked" — show exactly that text
      progressMsg = addonConfig.allRewardsUnlockedText;
    } else if (stagedTier && stagingHint?.field === 'before') {
      // Editing a tier's beforeText — show that tier's beforeText
      progressMsg = stagedTier.beforeText
        ? fillTemplate(stagedTier.beforeText, stagedTier)
        : `Add more for <strong>${stagedTier.label}</strong>`;
    } else if (stagedTier && (stagingHint?.field === 'after' || stagingHint?.field === 'gift')) {
      // Editing a tier's afterText or gifts — show that tier's afterText
      progressMsg = stagedTier.afterText
        ? fillTemplate(stagedTier.afterText, stagedTier)
        : `${stagedTier.label} unlocked!`;
    } else if (nextTier) {
      // Default: show next unreached tier's beforeText
      if (nextTier.beforeText) {
        progressMsg = fillTemplate(nextTier.beforeText, nextTier);
      } else {
        const remaining = nextTier.goal - demoValue;
        const unit = thresholdMode === 'dollars' ? '$' : '';
        const suffix = thresholdMode === 'items' && remaining !== 1 ? ' items' : thresholdMode === 'items' ? ' item' : '';
        progressMsg = `Add ${unit}${remaining}${suffix} more for ${nextTier.label}`;
      }
    } else if (sortedTiers.length > 0) {
      // All tiers reached — show highest tier's afterText or allRewardsUnlockedText
      const highest = sortedTiers[sortedTiers.length - 1];
      progressMsg = highest.afterText
        ? fillTemplate(highest.afterText, highest)
        : (addonConfig.allRewardsUnlockedText || 'All rewards unlocked!');
    } else {
      progressMsg = 'Set up reward tiers';
    }

    // Build milestone circles + bar segments using the SAME CSS classes as the
    // live theme (black icons, pulse animation, proper sizing from REAL_CART_CSS)
    let barHtml = '';
    for (let i = 0; i < sortedTiers.length; i++) {
      const tier = sortedTiers[i];
      const reached = demoValue >= tier.goal;
      const iconDef = REWARD_ICONS[tier.icon] || REWARD_ICONS['star'];
      // Show label under the icon — use tier label (short name), NOT the template text
      const displayText = tier.label;

      // Line segment before this milestone
      const lineFilled = reached || (i > 0 && demoValue >= sortedTiers[i - 1].goal);
      const lineHalf = !reached && i > 0 && demoValue >= sortedTiers[i - 1].goal;
      const lineClasses = ['ccd-progress__line'];
      if (i === 0 && reached) lineClasses.push('ccd-progress__line--filled');
      else if (lineFilled && !lineHalf) lineClasses.push('ccd-progress__line--filled');
      else if (lineHalf) lineClasses.push('ccd-progress__line--half');
      barHtml += `<div class="${lineClasses.join(' ')}"></div>`;

      // Milestone icon + label — uses theme CSS classes for black circles + pulse
      const msClasses = ['ccd-progress__milestone'];
      if (reached) msClasses.push('ccd-progress__milestone--reached');
      const iconClasses = ['ccd-progress__icon'];
      if (reached) iconClasses.push('ccd-progress__icon--reached');

      barHtml += `<div class="${msClasses.join(' ')}">`
        + `<div class="${iconClasses.join(' ')}">${iconDef.svg}</div>`
        + `<span class="ccd-progress__label">${displayText}</span>`
        + `</div>`;
    }

    const allDone = sortedTiers.length > 0 && !nextTier;
    const msgClass = allDone ? 'ccd-progress__message ccd-progress__message--done' : 'ccd-progress__message';

    const rewardsHtml = sortedTiers.length > 0
      ? `<div class="ccd-progress" data-ccd-progress>`
        + `<div class="${msgClass}">${progressMsg}</div>`
        + `<div class="ccd-progress__bar-wrap">${barHtml}</div>`
        + `</div>`
      : '<div class="ccd-progress" data-ccd-progress style="text-align:center;font-size:12px;color:#999;padding:10px 0">No reward tiers configured</div>';

    if (position === 'header') {
      cartHtml = cartHtml.replace(
        '<div class="drawer__fixed-header">',
        '<div class="drawer__fixed-header">' + rewardsHtml
      );
    } else if (position === 'below-items') {
      cartHtml = cartHtml.replace(
        '<div class="ccd-sticky-footer">',
        '<div class="ccd-sticky-footer">' + rewardsHtml
      );
    } else {
      cartHtml = cartHtml.replace(
        '<div class="cart__items">',
        rewardsHtml + '<div class="cart__items">'
      );
    }

    // ── Gift item preview: inject gift product(s) into cart items when a tier with gifts is staged ──
    // Renders gifts exactly like the live cart (v14-complete.js enforceGiftItem):
    // regular ccd-item with qty hidden, configurable badge, "Free" price
    // Shows automatically whenever the staged tier has gifts (no explicit toggle needed)
    if (stagedTier) {
      const gifts: Array<{ title?: string; imageUrl?: string; handle?: string; price?: string }> =
        stagedTier.giftProducts ?? (stagedTier.giftProduct ? [stagedTier.giftProduct] : []);
      if (gifts.length > 0) {
        // Badge config — use addon-level settings with defaults
        const badgeEnabled = addonConfig.giftBadgeEnabled !== false;
        const badgeText = addonConfig.giftBadgeText || 'Bonus gift';
        const badgeIconKey = addonConfig.giftBadgeIcon || 'gift';
        const badgeTextColor = addonConfig.giftBadgeTextColor || '#1a7a1a';
        const badgeBgColor = addonConfig.giftBadgeBgColor || '#edf7ed';
        const badgeIconDef = REWARD_ICONS[badgeIconKey] || REWARD_ICONS['gift'];
        const badgeIconSvg = badgeIconDef.svg
          .replace('fill="currentColor"', `fill="${badgeTextColor}"`)
          .replace(/width="\d+"/, 'width="14"')
          .replace(/height="\d+"/, 'height="14"');
        const fallbackSvg = REWARD_ICONS['gift'].svg.replace('fill="currentColor"', 'fill="#6b7280"');

        const showComparePrice = addonConfig.giftShowComparePrice !== false;

        let giftHtml = '';
        for (const gift of gifts) {
          const imgSrc = gift.imageUrl || '';
          const imgBlock = imgSrc
            ? `<div class="ccd-item__image"><a href="#"><img src="${imgSrc}" alt="${gift.title || 'Gift'}"></a></div>`
            : `<div class="ccd-item__image" style="background:#f8f8f8;width:120px;min-width:120px;height:120px;border-radius:8px;display:flex;align-items:center;justify-content:center">${fallbackSvg}</div>`;
          const badgeHtml = badgeEnabled
            ? `<span class="ccd-gift-badge" style="color:${badgeTextColor};background:${badgeBgColor}">${badgeIconSvg} ${badgeText}</span>`
            : '';
          const comparePriceHtml = (showComparePrice && gift.price)
            ? `<span class="ccd-item__compare-price">$${gift.price}</span>`
            : '';
          giftHtml += `<div class="ccd-item">`
            + imgBlock
            + `<div class="ccd-item__details">`
            + `<div class="ccd-item__title-row">`
            + `<a href="#" class="ccd-item__name">${gift.title || 'Gift Product'}</a>`
            + `</div>`
            + `<div class="ccd-item__bottom">`
            + `<div></div>`
            + `<div class="ccd-item__price-col">`
            + `<div class="ccd-item__price-row">${comparePriceHtml}<span class="ccd-item__price ccd-item__price--free">Free</span></div>`
            + badgeHtml
            + `</div>`
            + `</div></div></div>`;
        }
        // Inject before the end of cart__items
        cartHtml = cartHtml.replace(
          '</div>\n      </div>\n    </div>\n    <div class="ccd-sticky-footer">',
          giftHtml + '</div>\n      </div>\n    </div>\n    <div class="ccd-sticky-footer">'
        );
      }
    }
  }

  // ── Upsell Recommendations: dynamic headline, layout, position ─────
  if (addonKey === 'upsellRecommendations') {
    // Legacy slugs from when headline was a preset dropdown — map to bold+centered HTML.
    const LEGACY_HEADLINES: Record<string, string> = {
      'you-may-also-like': '<div style="text-align:center"><strong>You may also like</strong></div>',
      'complete-your-order': '<div style="text-align:center"><strong>Complete your order</strong></div>',
      'customers-also-bought': '<div style="text-align:center"><strong>Customers also bought</strong></div>',
    };
    let rawHeadline = (typeof addonConfig.headline === 'string') ? addonConfig.headline.trim() : '';
    if (LEGACY_HEADLINES[rawHeadline]) rawHeadline = LEGACY_HEADLINES[rawHeadline];
    const headlineHtml = rawHeadline || '<div style="text-align:center"><strong>You may also like</strong></div>';
    const layout = addonConfig.layout || 'horizontal-scroll';
    const position = addonConfig.position || 'below-items';
    const source = addonConfig.source || 'shopify-recommendations';
    const maxProducts = Math.max(1, Math.min(6, Number(addonConfig.maxProducts) || 3));
    const manualProducts: Array<{ title?: string; price?: string | number; image?: string }> =
      Array.isArray(addonConfig.manualProducts) ? addonConfig.manualProducts : [];

    const productCard = (name: string, price: string, img: string) => {
      const imgHtml = img
        ? '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover" alt="' + name + '">'
        : '<svg width="30" height="30" viewBox="0 0 24 24" fill="#ccc"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
      return '<div style="min-width:120px;flex-shrink:0;text-align:center"><div style="width:80px;height:80px;background:#f5f5f5;border-radius:8px;margin:0 auto 6px;overflow:hidden;display:flex;align-items:center;justify-content:center">' + imgHtml + '</div><div style="font-size:11px;font-weight:600;margin-bottom:2px">' + name + '</div><div style="font-size:12px;color:#666">' + price + '</div><button style="margin-top:4px;padding:4px 12px;font-size:11px;background:var(--ccd-primary);color:#fff;border:none;border-radius:4px;cursor:pointer">Add</button></div>';
    };

    // Build preview product list. Manual source uses the merchant's picks; others use a sample.
    let productList: string[] = [];
    if (source === 'manual' && manualProducts.length > 0) {
      productList = manualProducts.slice(0, maxProducts).map(p =>
        productCard(p.title || 'Product', '$' + (p.price ?? '0.00'), p.image || '')
      );
    } else if (previewProducts.length > 0) {
      productList = previewProducts.slice(0, maxProducts).map(p =>
        productCard(p.title, '$' + p.price, p.image)
      );
    }
    // Top up with placeholder cards so the layout always shows `maxProducts` slots in preview.
    while (productList.length < maxProducts) {
      const i = productList.length;
      productList.push(productCard(
        ['Product A', 'Product B', 'Product C', 'Product D', 'Product E', 'Product F'][i],
        ['$29.99', '$49.99', '$19.99', '$39.99', '$24.99', '$59.99'][i],
        ''
      ));
    }

    let layoutStyle = 'display:flex;justify-content:center;gap:12px;overflow-x:auto;padding:4px 0 0 0';
    if (layout === 'single-card') layoutStyle = 'display:flex;justify-content:center;padding:4px 0 0 0';
    if (layout === 'stacked-list') layoutStyle = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 0 0 0';

    const itemsToShow = layout === 'single-card' ? productList.slice(0, 1) : productList;
    const upsellHtml = '<div id="ccd-upsell" style="padding:4px 0 8px 0"><div class="ccd-upsell-headline" style="font-size:13px;margin-bottom:4px">' + headlineHtml + '</div><div style="' + layoutStyle + '">' + itemsToShow.join('') + '</div></div>';

    if (position === 'above-footer') {
      cartHtml = cartHtml.replace(
        '<div class="ccd-sticky-footer">',
        '<div class="ccd-sticky-footer">' + upsellHtml
      );
    } else if (position === 'after-checkout') {
      cartHtml = cartHtml.replace(
        '<div class="ccd-trust">',
        upsellHtml + '<div class="ccd-trust">'
      );
    } else {
      // below-items (default)
      cartHtml = cartHtml.replace(
        '</div>\n      </div>\n    </div>\n    <div class="ccd-sticky-footer">',
        '</div>' + upsellHtml + '</div></div><div class="ccd-sticky-footer">'
      );
      if (!cartHtml.includes('ccd-upsell')) {
        cartHtml = cartHtml.replace(
          '<div class="ccd-sticky-footer">',
          upsellHtml + '<div class="ccd-sticky-footer">'
        );
      }
    }
  }

  // ── Social Proof: dynamic text, style, position ────────────────────
  if (addonKey === 'socialProof') {
    const textTemplate = addonConfig.textTemplate || 'people-viewing';
    const spStyle = addonConfig.style || 'subtle-text';
    const position = addonConfig.position || 'header';

    const count = Math.floor(Math.random() * 20) + 8;
    const textMap: Record<string, string> = {
      'people-viewing': '👀 ' + count + ' people are viewing this right now',
      'bought-today': '🔥 ' + count + ' bought today',
      'in-carts': '🛒 In ' + count + ' carts right now',
    };
    const proofText = textMap[textTemplate] || textMap['people-viewing'];

    let proofHtml = '';
    if (spStyle === 'subtle-text') {
      proofHtml = '<div id="ccd-social-proof" style="text-align:center;font-size:12px;color:var(--ccd-text-muted);padding:6px 0">' + proofText + '</div>';
    } else if (spStyle === 'badge-animated') {
      proofHtml = '<div id="ccd-social-proof" style="text-align:center;padding:6px 0"><span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:600;padding:4px 12px;border-radius:12px;animation:bounce 1s ease-in-out infinite">' + proofText + '</span></div><style>@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}</style>';
    } else {
      // toast
      proofHtml = '<div id="ccd-social-proof" style="position:fixed;bottom:12px;left:12px;right:12px;background:#1f2937;color:#fff;font-size:12px;padding:10px 16px;border-radius:8px;text-align:center;z-index:100">' + proofText + '</div>';
    }

    if (position === 'above-checkout') {
      cartHtml = cartHtml.replace(
        '<button type="button" class="ccd-checkout-btn">',
        proofHtml + '<button type="button" class="ccd-checkout-btn">'
      );
    } else if (position === 'floating') {
      // Add at end of body
      cartHtml = cartHtml + proofHtml;
    } else {
      // header (default)
      cartHtml = cartHtml.replace(
        '<div class="ccd-progress">',
        proofHtml + '<div class="ccd-progress">'
      );
    }
  }

  // ── Express Payments — delegated to the shared transform. Native Shopify
  // wallets can't be rendered without the Shopify SDK, so the preview shows an
  // honest placeholder note (ccd-express--native) positioned below/above the
  // checkout button. The live storefront (v14 CCD.injectExpressPayments)
  // relocates the real #ccd-native-express-host into the same slot.
  if (addonKey === 'expressPayments') {
    cartHtml = applyExpressPayments(cartHtml, addonConfig);
  }

  // ── Notes / Discount Code / Terms Checkbox — delegated to shared transforms
  // so focused preview produces the SAME footer-row class names + IDs the live
  // storefront (v14-complete.js) injects (#ccd-notes-row / #ccd-discount-code-row
  // / #ccd-terms-row). Matches the class-name contract enforced by the
  // addon-transforms-footer-zones blast-radius tests.
  if (addonKey === 'notes') {
    cartHtml = applyNotes(cartHtml, addonConfig);
  }
  if (addonKey === 'customCode') {
    cartHtml = applyCustomCode(cartHtml, addonConfig);
  }
  if (addonKey === 'discountCode') {
    cartHtml = applyDiscountCode(cartHtml, addonConfig);
  }
  if (addonKey === 'termsCheckbox') {
    cartHtml = applyTermsCheckbox(cartHtml, addonConfig);
  }

  // ── Hide built-in returns line ─────────────────────────────────────
  // Mirrors renderPreview + v14 CCD.injectCustomCode. When the customCode addon
  // is enabled with hideBuiltInTrustLine, drop the built-in `.ccd-trust` returns
  // line so a seeded returns badge isn't shown twice. Runs AFTER every transform
  // (upsell inserts before .ccd-trust, so this must be last). Default OFF.
  const customCodeCfg: Record<string, any> | null = addonKey === 'customCode'
    ? addonConfig
    : (() => {
        const raw = liveAddons?.customCode;
        if (!raw) return null;
        const isWrapped = typeof raw === 'object' && ('enabled' in raw || 'config' in raw);
        const enabled = isWrapped ? raw.enabled !== false : true;
        if (!enabled) return null;
        return isWrapped ? (raw.config || {}) : (raw as Record<string, any>);
      })();
  if (customCodeCfg?.hideBuiltInTrustLine) {
    cartHtml = hideBuiltInTrustLine(cartHtml);
  }

  const focusArea = FOCUS_AREAS[addonKey];
  // When staged tier has gifts, scroll to the last cart item (the gift)
  let hasGiftInStaged = false;
  if (stagingHint?.context === 'tier' && stagingHint.tierIndex != null && addonKey === 'freeShippingBar') {
    const sortedForScroll = [...(addonConfig.tiers ?? [])].sort((a: any, b: any) => a.goal - b.goal);
    const scrollTier = sortedForScroll[stagingHint.tierIndex];
    const scrollGifts = scrollTier?.giftProducts ?? (scrollTier?.giftProduct ? [scrollTier.giftProduct] : []);
    hasGiftInStaged = scrollGifts.length > 0;
  }
  const giftScrollScript = hasGiftInStaged
    ? '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){var items=document.querySelectorAll(".ccd-item");var last=items[items.length-1];if(last){var sc=document.querySelector(".drawer__scrollable");if(sc)sc.scrollTop=sc.scrollHeight;}},200)})</scr' + 'ipt>'
    : '';
  const scrollScript = giftScrollScript || (mode === 'focused' && focusArea
    ? '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){var el=document.querySelector(".' + focusArea.scrollTo + '")||document.getElementById("' + focusArea.scrollTo + '");if(el){el.scrollIntoView({block:"center"});el.style.background="rgba(59,130,246,0.05)";el.style.borderRadius="8px";el.style.transition="background 0.5s"}},150)})</scr' + 'ipt>'
    : '');

  const heightScript = mode === 'full'
    ? '<scr' + 'ipt>function nh(){var h=document.body.scrollHeight;window.parent.postMessage({type:"aph",h:h},"*")}window.addEventListener("load",function(){setTimeout(nh,100)});new MutationObserver(nh).observe(document.body,{childList:true,subtree:true})</scr' + 'ipt>'
    : '';

    // Override CSS variables with live theme colors
  let themeCssOverride = '';
  if (themeSettings) {
    const overrides: string[] = [];
    if (themeSettings.ccd_color_primary) overrides.push('--ccd-primary:' + themeSettings.ccd_color_primary);
    if (themeSettings.ccd_color_background) overrides.push('--ccd-bg:' + themeSettings.ccd_color_background);
    if (themeSettings.ccd_color_progress_bg) overrides.push('--ccd-progress-bg:' + themeSettings.ccd_color_progress_bg);
    if (themeSettings.ccd_color_success) overrides.push('--ccd-success:' + themeSettings.ccd_color_success);
    if (themeSettings.ccd_scarcity_color) overrides.push('--ccd-scarcity-color:' + themeSettings.ccd_scarcity_color);
    if (overrides.length) themeCssOverride = ':root{' + overrides.join(';') + '}';
  }

  // Remove bottom fade when staging a tier with gifts so gift items are fully visible
  if (stagingHint?.context === 'tier' && stagingHint.tierIndex != null && addonKey === 'freeShippingBar') {
    const sortedForFade = [...(addonConfig.tiers ?? [])].sort((a: any, b: any) => a.goal - b.goal);
    const fadeTier = sortedForFade[stagingHint.tierIndex];
    const fadeGifts = fadeTier?.giftProducts ?? (fadeTier?.giftProduct ? [fadeTier.giftProduct] : []);
    if (fadeGifts.length > 0) {
      themeCssOverride += '#CartDrawer.custom-cart-drawer .drawer__inner::after{display:none !important;}';
    }
  }

  // Milestone animation override based on config
  const animType = addonConfig.milestoneAnimationType ?? 'pulse';
  const animEnabled = addonConfig.milestoneAnimation !== false;
  if (!animEnabled || animType === 'none') {
    themeCssOverride += '.ccd-progress__icon--reached{animation:none !important;}';
  } else if (animType === 'bounce') {
    themeCssOverride += '@keyframes ccdMilestoneBounce{0%,100%{transform:translateY(0) scale(1)}30%{transform:translateY(-5px) scale(1.05)}50%{transform:translateY(-2px) scale(1.02)}70%{transform:translateY(-4px) scale(1.04)}}'
      + '.ccd-progress__icon--reached{animation:ccdMilestoneBounce 1.6s ease-in-out infinite !important;}';
  } else if (animType === 'heartbeat') {
    themeCssOverride += '@keyframes ccdMilestoneHeartbeat{0%,100%{transform:scale(1)}14%{transform:scale(1.15)}28%{transform:scale(1)}42%{transform:scale(1.1)}56%{transform:scale(1)}}'
      + '.ccd-progress__icon--reached{animation:ccdMilestoneHeartbeat 1.8s ease-in-out infinite !important;}';
  } else if (animType === 'shake') {
    themeCssOverride += '@keyframes ccdMilestoneShake{0%,100%{transform:rotate(0)}15%{transform:rotate(-10deg)}30%{transform:rotate(10deg)}45%{transform:rotate(-6deg)}60%{transform:rotate(6deg)}75%{transform:rotate(-2deg)}}'
      + '.ccd-progress__icon--reached{animation:ccdMilestoneShake 1.5s ease-in-out infinite !important;}';
  }
  // 'pulse' uses the default CSS from REAL_CART_CSS — no override needed

  const srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'
    + REAL_CART_CSS + themeCssOverride
    + '</style></head><body style="margin:0;padding:0;' + (mode === 'focused' ? 'overflow:hidden' : '') + '">'
    + cartHtml
    + scrollScript
    + heightScript
    + '</body></html>';

  useEffect(() => {
    if (mode !== 'full') return;
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'aph' && e.data.h) {
        setIframeHeight(Math.min(e.data.h + 10, 900));
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mode]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 375, borderRadius: 16, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <iframe
          srcDoc={srcdoc}
          style={{
            width: 375,
            height: mode === 'focused' ? (FOCUS_AREAS[addonKey]?.height || 200) : iframeHeight,
            border: 'none',
            display: 'block',
          }}
          sandbox="allow-scripts"
          title={'Addon preview - ' + addonKey}
        />
      </div>
    </div>
  );
}