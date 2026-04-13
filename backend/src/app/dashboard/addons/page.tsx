'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AddonPreview from './addon-preview';
import RewardsTierEditor, { RewardsTierEditorWithSave } from './rewards-tier-editor';
import { useStore } from '@/lib/hooks/use-store';

// ─── Constants ──────────────────────────────────────────────────────────────

// STORE_ID is now resolved dynamically via useStore() hook
const API = '';

// Payment SVG Icons for checkbox rendering
const PAYMENT_ICON_SVGS: Record<string, string> = {
  'visa': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#1434CB"/><path d="M489.823 143.111C442.988 143.111 401.134 167.393 401.134 212.256C401.134 263.706 475.364 267.259 475.364 293.106C475.364 303.989 462.895 313.731 441.6 313.731C411.377 313.731 388.789 300.119 388.789 300.119L379.123 345.391C379.123 345.391 405.145 356.889 439.692 356.889C490.898 356.889 531.19 331.415 531.19 285.784C531.19 231.419 456.652 227.971 456.652 203.981C456.652 195.455 466.887 186.114 488.122 186.114C512.081 186.114 531.628 196.014 531.628 196.014L541.087 152.289C541.087 152.289 519.818 143.111 489.823 143.111ZM61.3294 146.411L60.1953 153.011C60.1953 153.011 79.8988 156.618 97.645 163.814C120.495 172.064 122.122 176.868 125.971 191.786L167.905 353.486H224.118L310.719 146.411H254.635L198.989 287.202L176.282 167.861C174.199 154.203 163.651 146.411 150.74 146.411H61.3294ZM333.271 146.411L289.275 353.486H342.756L386.598 146.411H333.271ZM631.554 146.411C618.658 146.411 611.825 153.318 606.811 165.386L528.458 353.486H584.542L595.393 322.136H663.72L670.318 353.486H719.805L676.633 146.411H631.554ZM638.848 202.356L655.473 280.061H610.935L638.848 202.356Z" fill="white"/></svg>',
  'mastercard': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#000"/><path d="M465.7 69.1H314.2v273h151.6z" fill="#FF5A00"/><path d="M323.9 205.6c0-55.5 26.1-104.7 66.1-136.5A189.6 189.6 0 00282.9 32C186.9 32 109.3 109.6 109.3 205.6s77.6 173.6 173.6 173.6c40.5 0 77.6-14 107.1-37.1a189.6 189.6 0 01-66.1-136.5z" fill="#EB001B"/><path d="M670.7 205.6c0 96-77.6 173.6-173.6 173.6-40.5 0-77.6-14-107-37.1a189.6 189.6 0 000-273.1c29.4-23.1 66.5-37.1 107-37.1 96 0 173.6 77.6 173.6 173.6z" fill="#F79E1B"/></svg>',
  'amex': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#006FCF"/><text x="390" y="320" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="190" fill="white" letter-spacing="10">AMEX</text></svg>',
  'paypal': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><path d="M168.4 169.9c-8.4-5.8-19.4-8.7-32.9-8.7H83.2c-4.1 0-6.4 2.1-6.9 6.2L55 300.9c-.2 1.3.1 2.5 1 3.6s2 1.6 3.3 1.6h24.9c4.4 0 6.8-2.1 7.2-6.2l5.9-36c.2-1.7 1-3.2 2.3-4.3 1.3-1.1 2.9-1.8 4.9-2.1 2-.3 3.8-.5 5.6-.5s3.8.1 6.2.3c2.4.2 3.9.3 4.6.3 18.8 0 33.5-5.3 44.2-15.9 10.7-10.6 16-25.2 16-44 0-12.9-4.2-22.2-12.6-28zm-27 40.1c-1.1 7.6-3.9 12.6-8.5 15s-11.1 3.6-19.6 3.6l-10.8.3 5.6-35c.4-2.4 1.9-3.6 4.3-3.6h6.2c8.7 0 15 1.3 19 3.8 3.9 2.5 5.2 7.8 3.9 15.9z" fill="#003087"/><path d="M540 169.9c-8.4-5.8-19.4-8.7-32.9-8.7h-52c-4.4 0-6.8 2.1-7.2 6.2l-21.3 133.5c-.2 1.3.1 2.5 1 3.6s2 1.6 3.3 1.6h26.8c2.6 0 4.4-1.4 5.2-4.3l5.9-37.9c.2-1.7 1-3.2 2.3-4.3 1.3-1.1 2.9-1.8 4.9-2.1 2-.3 3.8-.5 5.6-.5s3.8.1 6.2.3c2.4.2 3.9.3 4.6.3 18.8 0 33.5-5.3 44.2-15.9 10.7-10.6 16-25.2 16-44 0-12.9-4.2-22.2-12.6-28zm-33.5 53.8c-4.8 3.3-12 4.9-21.6 4.9l-10.5.3 5.6-35c.4-2.4 1.8-3.6 4.3-3.6h5.9c4.8 0 8.6.2 11.5.7 2.8.4 5.6 1.8 8.2 4.1 2.6 2.3 3.9 5.6 3.9 10 0 9.2-2.4 15.4-7.2 18.6z" fill="#009CDE"/><path d="M291.2 209.3h-24.9c-3.1 0-4.9 3.6-5.6 10.8-5.9-8.7-16.2-13.1-31.1-13.1-15.7 0-29.1 5.9-40.1 17.7-11 11.8-16.5 25.6-16.5 41.6 0 12.9 3.8 23.1 11.3 30.7 7.5 7.6 17.6 11.5 30.3 11.5 6.3 0 12.8-1.3 19.3-3.9 6.5-2.6 11.8-6.1 15.7-10.5-.9 2.6-1.3 4.9-1.3 6.9 0 3.5 1.4 5.2 4.3 5.2h22.6c4.1 0 6.5-2.1 7.2-6.2l13.4-85.4c.2-1.3-.1-2.5-1-3.6s-2-1.6-3.3-1.6zm-42.7 64.6c-5.6 5.4-12.4 8-20.4 8-6.3 0-11.4-1.7-15.2-5.2-3.8-3.5-5.7-8.3-5.7-14.4 0-8.1 2.7-14.9 8.2-20.4 5.4-5.6 12.2-8.3 20.3-8.3 6.1 0 11.2 1.8 15.2 5.4s6.1 8.6 6.1 14.9c0 8.1-2.8 14.8-8.3 20.1z" fill="#003087"/><path d="M662.9 209.3h-24.9c-3.1 0-4.9 3.6-5.6 10.8-5.7-8.7-16-13.1-31.1-13.1-15.7 0-29.1 5.9-40.1 17.7-11 11.8-16.5 25.6-16.5 41.6 0 12.9 3.8 23.1 11.3 30.7 7.5 7.6 17.6 11.5 30.3 11.5 6.3 0 12.8-1.3 19.3-3.9 6.5-2.6 11.7-6.1 15.4-10.5 0 .2-.2 1.2-.7 2.9-.4 1.7-.7 3.1-.7 3.9 0 3.5 1.4 5.2 4.3 5.2h22.6c4.1 0 6.5-2.1 7.2-6.2l13.4-85.4c.2-1.3-.1-2.5-1-3.6s-2-1.6-3.3-1.6zm-42.7 64.5c-5.6 5.5-12.3 8.2-20.1 8.2-6.3 0-11.4-1.7-15.4-5.2-3.9-3.5-5.9-8.3-5.9-14.4 0-8.1 2.7-14.9 8.2-20.4 5.4-5.6 12.2-8.3 20.3-8.3 6.1 0 11.2 1.8 15.2 5.4 4 3.6 6.1 8.6 6.1 14.9 0 7.9-2.8 14.5-8.3 20z" fill="#009CDE"/><path d="M428.3 213.9c0-1.1-.4-2.1-1.3-3.1s-1.9-1.5-2.9-1.5h-25.2c-2.4 0-4.4 1.1-5.9 3.3l-34.7 51-14.4-49.1c-1.1-3.5-3.5-5.2-7.2-5.2h-24.5c-1.1 0-2.1.5-2.9 1.5s-1.3 2-1.3 3.1c0 .4 2.1 6.9 6.4 19.3 4.3 12.4 8.8 25.8 13.7 40.2 4.9 14.4 7.5 22 7.7 22.9-17.9 24.4-26.8 37.5-26.8 39.3 0 2.8 1.4 4.3 4.3 4.3h25.2c2.4 0 4.4-1.1 5.9-3.3l83.4-120.4c.4-.4.7-1.2.7-2.3z" fill="#003087"/><path d="M720.8 161.2h-24.2c-2.4 0-3.8 1.2-4.3 3.6l-21.3 136.1-.3.7c0 1.1.4 2.1 1.3 3.1s2 1.5 3.3 1.5h21.6c4.1 0 6.4-2.1 6.9-6.2l21.3-133.8v-.3c0-3.1-1.4-4.6-4.3-4.6z" fill="#009CDE"/></svg>',
  'discover': '<?xml encoding="UTF-8"?><svg width="42" height="28" viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M54.992 0C24.627 0 0 24.63 0 55.004v390.992C0 476.376 24.619 501 54.992 501h670.016C755.373 501 780 476.37 780 445.996V55.004C780 24.624 755.381 0 725.008 0H54.992z" fill="#4D4D4D"/><path d="M327.152 161.893c8.837 0 16.248 1.784 25.268 6.09v22.751c-8.544-7.863-15.955-11.154-25.756-11.154-19.264 0-34.414 15.015-34.414 34.05 0 20.075 14.681 34.196 35.37 34.196 9.312 0 16.586-3.12 24.8-10.857v22.763c-9.341 4.14-16.911 5.776-25.756 5.776-31.278 0-55.582-22.596-55.582-51.737 0-28.826 24.951-51.878 56.07-51.878zm-97.113.627c11.546 0 22.11 3.72 30.943 10.994l-10.748 13.248c-5.35-5.646-10.41-8.028-16.564-8.028-8.853 0-15.3 4.745-15.3 10.989 0 5.354 3.619 8.188 15.944 12.482 23.365 8.044 30.29 15.176 30.29 30.926 0 19.193-14.976 32.553-36.32 32.553-15.63 0-26.994-5.795-36.458-18.872l13.268-12.03c4.73 8.61 12.622 13.222 22.42 13.222 9.163 0 15.947-5.952 15.947-13.984 0-4.164-2.055-7.734-6.158-10.258-2.066-1.195-6.158-2.977-14.2-5.647-19.291-6.538-25.91-13.527-25.91-27.185 0-16.225 14.214-28.41 32.846-28.41zm234.723 1.728h22.437l28.084 66.592 28.446-66.592h22.267l-45.494 101.686h-11.053l-44.687-101.686zm-397.348.152h30.15c33.312 0 56.534 20.382 56.534 49.641 0 14.59-7.104 28.696-19.118 38.057-10.108 7.901-21.626 11.445-37.574 11.445H67.414V164.4zm96.135 0h20.54v99.143h-20.54V164.4zm411.734 0h58.252v16.8H595.81v22.005h36.336v16.791h-36.336v26.762h37.726v16.785h-58.252V164.4zm71.858 0h30.455c23.69 0 37.265 10.71 37.265 29.272 0 15.18-8.514 25.14-23.986 28.105l33.148 41.766h-25.26l-28.429-39.828h-2.678v39.828h-20.515V164.4zm20.515 15.616v30.025h6.002c13.117 0 20.069-5.362 20.069-15.328 0-9.648-6.954-14.697-19.745-14.697h-6.326zM87.94 181.199v65.559h5.512c13.273 0 21.656-2.394 28.11-7.88 7.103-5.955 11.376-15.465 11.376-24.98 0-9.499-4.273-18.725-11.376-24.681-6.785-5.78-14.837-8.018-28.11-8.018H87.94z" fill="#FFF"/><path d="m415.13 161.21c30.941 0 56.022 23.58 56.022 52.709v0.033c0 29.13-25.081 52.742-56.021 52.742s-56.022-23.613-56.022-52.742v-0.033c0-29.13 25.082-52.71 56.022-52.71zm364.85 127.15c-26.05 18.33-221.08 149.34-558.75 212.62h503.76c30.365 0 54.992-24.63 54.992-55.004v-157.62z" fill="#F47216"/></g></svg>',
  'jcb': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#0E4C96"/><path d="M632.2 361.3c0 41.6-33.7 75.4-75.4 75.4H147.7V138.8c0-41.6 33.7-75.4 75.4-75.4h409.1v297.9z" fill="#fff"/><path d="M498.9 256.5c11.7.3 23.4-.5 35.1.4 11.8 2.2 14.6 20 4.2 25.9-7.1 3.9-15.6 1.4-23.4 2.1h-15.9v-28.4zm41.8-32.1c2.6 9.2-6.2 17.4-15.1 16.1h-26.8c.2-8.6-.4-18 .3-26.2 10.7.3 21.5-.6 32.2.5 4.6 1.1 8.4 4.9 9.4 9.6z" fill="#007B40"/><path d="M605.1 88.5c.5 17.5.1 35.9.2 53.8v217.8c-.5 27.2-24.6 50.8-51.6 51.4H524V301.8c29.5-.2 59 .3 88.4-.2 13.7-.9 28.6-9.9 29.3-24.9 1.6-15.1-12.6-25.6-26.2-27.2-5.2-.1-5-1.5 0-2.1 12.9-2.8 23-16.1 19.2-29.5-3.2-14.1-18.8-19.5-31.7-19.5-26.4-.2-52.7 0-79.1-.1.2-20.5-.4-41 .3-61.5 2.1-26.7 26.8-48.7 53.4-48.3h78.9z" fill="#007B40"/><path d="M174.7 139.5c.7-27.2 24.9-50.6 51.9-51h80.8v272.7c-1 26.8-25 49.8-51.7 50.3H174.7V298c26.2 6.2 53.7 8.8 80.5 4.7 16-2.6 33.5-10.4 38.9-27 4-14.2 1.7-29.1 2.3-43.7v-33.8h-46.3c-.2 22.4.4 44.8-.3 67.1-1.2 13.7-14.8 22.5-27.8 22-16.1.2-47.9-11.6-47.9-11.6V139.5z" fill="#1D2970"/><path d="M324.7 211.9c-2.4.5-.5-8.3-1.1-11.6.2-21.2-.3-42.3.3-63.5 2.1-26.8 27-48.9 53.7-48.3h78.8v272.7c-1 26.8-25 49.8-51.7 50.3H324v-124.3c18.4 15.1 43.5 17.5 66.5 17.5 17.3 0 34.5-2.7 51.3-6.7V275c-19 9.4-41.2 15.4-62.2 10-14.7-3.7-25.3-17.8-25.1-32.9-1.7-15.7 7.5-32.3 23-37 19.2-6 40.1-1.4 58.1 6.4 3.9 2 7.8 4.5 6.2-1.9v-17.9c-30.1-7.2-62.1-9.8-92.3-2-8.7 2.5-17.3 6.2-24.4 12z" fill="#E30138"/></svg>',
  'diners': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#0079BE"/><path d="M599.9 251.4c0-99.4-83-168.1-173.9-168.1h-78.2c-92 0-167.7 68.7-167.7 168.1 0 90.9 75.7 165.6 167.7 165.2h78.2c90.9.4 173.9-74.3 173.9-165.2z" fill="#fff"/><path d="M348.3 97.4c-84.1 0-152.2 68.3-152.2 152.6 0 84.3 68.1 152.5 152.2 152.6 84.1 0 152.2-68.3 152.2-152.6 0-84.3-68.1-152.6-152.2-152.6z" fill="#0079BE"/><path d="M252.1 249.6c.1-41.2 25.7-76.3 61.9-90.3v180.5c-36.2-13.9-61.9-49-61.9-90.2zm131 90.3V159.4c36.2 13.9 61.9 49 62 90.3-.1 41.2-25.8 76.3-62 90.3z" fill="#fff"/></svg>',
  'unionpay': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><path d="M216.4 69.8h142.4c19.9 0 32.3 16.4 27.6 36.5l-66.3 287.5c-4.7 20.1-24.6 36.5-44.5 36.5H133.2c-19.9 0-32.3-16.4-27.6-36.5L172 106.3c4.7-20.2 24.5-36.5 44.4-36.5z" fill="#D10429"/><path d="M346.3 69.8h163.8c19.9 0 10.9 16.4 6.2 36.5l-66.3 287.5c-4.7 20.1-3.2 36.5-23.1 36.5H263.1c-20 0-32.3-16.4-27.5-36.5l66.3-287.5c4.7-20.2 24.5-36.5 44.5-36.5z" fill="#022E64"/><path d="M504.4 69.8h142.4c19.9 0 32.3 16.4 27.6 36.5l-66.3 287.5c-4.7 20.1-24.6 36.5-44.5 36.5H421.2c-20 0-32.3-16.4-27.6-36.5l66.3-287.5c4.7-20.2 24.5-36.5 44.4-36.5z" fill="#076F74"/></svg>',
  'maestro': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#000"/><path d="M465.8 69H314.2v273h151.6z" fill="#7673C0"/><path d="M323.8 205.3c0-55.5 26.1-104.7 66.1-136.5-29.4-23.1-66.5-37.1-107.1-37.1C186.9 32 109.3 109.6 109.3 205.6s77.6 173.6 173.6 173.6c40.5 0 77.6-14 107.1-37.1-40-31.8-66.1-81-66.1-136.5z" fill="#EB001B"/><path d="M670.2 205.3c0 96-77.6 173.6-173.6 173.6-40.5 0-77.6-14-107-37.1 40-31.8 66.1-81 66.1-136.5s-26.1-104.7-66.1-136.5c29.4-23.1 66.5-37.1 107-37.1 96 0 173.6 77.6 173.6 173.6z" fill="#00A1DF"/></svg>',
  'apple-pay': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#000"/><g transform="translate(55,82) scale(14)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="white"/></g><text x="400" y="250" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-weight="300" font-size="180" dominant-baseline="central" fill="white">Pay</text></svg>',
  'google-pay': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><g transform="translate(126,-14) scale(22)"><path d="M3.963 7.235A3.963 3.963 0 00.422 9.419a3.963 3.963 0 000 3.559 3.963 3.963 0 003.541 2.184c1.07 0 1.97-.352 2.627-.957.748-.69 1.18-1.71 1.18-2.916a4.722 4.722 0 00-.07-.806H3.964v1.526h2.14a1.835 1.835 0 01-.79 1.205c-.356.241-.814.379-1.35.379-1.034 0-1.911-.697-2.225-1.636a2.375 2.375 0 010-1.517c.314-.94 1.191-1.636 2.225-1.636a2.152 2.152 0 011.52.594l1.132-1.13a3.808 3.808 0 00-2.652-1.033zm6.501.55v6.9h.886V11.89h1.465c.603 0 1.11-.196 1.522-.588a1.911 1.911 0 00.635-1.464 1.92 1.92 0 00-.635-1.456 2.125 2.125 0 00-1.522-.598zm2.427.85a1.156 1.156 0 01.823.365 1.176 1.176 0 010 1.686 1.171 1.171 0 01-.877.357H11.35V8.635h1.487a1.156 1.156 0 01.054 0zm4.124 1.175c-.842 0-1.477.308-1.907.925l.781.491c.288-.417.68-.626 1.175-.626a1.255 1.255 0 01.856.323 1.009 1.009 0 01.366.785v.202c-.34-.193-.774-.289-1.3-.289-.617 0-1.11.145-1.479.434-.37.288-.554.677-.554 1.165a1.476 1.476 0 00.525 1.156c.35.308.785.463 1.305.463.61 0 1.098-.27 1.465-.81h.038v.655h.848v-2.909c0-.61-.19-1.09-.568-1.44-.38-.35-.896-.525-1.551-.525zm2.263.154l1.946 4.422-1.098 2.38h.915L24 9.963h-.965l-1.368 3.391h-.02l-1.406-3.39zm-2.146 2.368c.494 0 .88.11 1.156.33 0 .372-.147.696-.44.973a1.413 1.413 0 01-.997.414 1.081 1.081 0 01-.69-.232.708.708 0 01-.293-.578c0-.257.12-.47.363-.647.24-.173.54-.26.9-.26Z" fill="#5f6368"/></g></svg>',
  'shop-pay': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#5A31F4"/><g transform="translate(174,34) scale(18)"><path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" fill="white"/></g></svg>',
  'klarna': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#FFB3C7"/><g transform="translate(150,30) scale(20)"><path d="M4.592 2v20H0V2h4.592zm11.46 0c0 4.194-1.583 8.105-4.415 11.068l-.278.283L17.702 22h-5.668l-6.893-9.4 1.779-1.332c2.858-2.14 4.535-5.378 4.637-8.924L11.562 2h4.49zM21.5 17a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" fill="#0A0B09"/></g></svg>',
  'afterpay': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#B2FCE4"/><g transform="translate(150,30) scale(20)"><path d="M12 0C5.373 0 0 5.373 0 12c0 6.628 5.373 12 12 12 6.628 0 12-5.372 12-12 0-6.627-5.372-12-12-12Zm1.236 4.924a2.21 2.21 0 0 1 1.15.299l4.457 2.557c1.495.857 1.495 3.013 0 3.87l-4.457 2.558c-1.488.854-3.342-.22-3.342-1.935v-.34a.441.441 0 0 0-.66-.383L6.287 13.9a.441.441 0 0 0 0 .765l4.096 2.35a.44.44 0 0 0 .661-.382v-.685c0-.333.36-.542.649-.376l1.041.597a.441.441 0 0 1 .222.383v.29c0 1.715-1.854 2.789-3.342 1.935L5.157 16.22c-1.495-.857-1.495-3.013 0-3.87l4.457-2.558c1.488-.854 3.342.22 3.342 1.935v.34c0 .34.366.551.66.383l4.097-2.35a.441.441 0 0 0 0-.765l-4.096-2.351a.441.441 0 0 0-.661.382v.685c0 .333-.36.541-.649.375l-1.041-.597a.442.442 0 0 1-.222-.383v-.29c0-1.285 1.043-2.21 2.192-2.233z" fill="#000"/></g></svg>',
  'stripe': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#635BFF"/><g transform="translate(150,30) scale(20)"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" fill="white"/></g></svg>',
  'venmo': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#008CFF"/><g transform="translate(222,82) scale(14)"><path d="M21.772 13.119c-.267 0-.381-.251-.38-.655 0-.533.121-1.575.712-1.575.267 0 .357.243.357.598 0 .533-.13 1.632-.689 1.632Zm.502-3.377c-1.677 0-2.405 1.285-2.405 2.658 0 1.042.421 1.874 1.693 1.874 1.717 0 2.438-1.406 2.438-2.763 0-1.025-.462-1.769-1.726-1.769Zm-3.833 0c-.558 0-.964.17-1.393.477-.154-.275-.462-.477-.932-.477-.542 0-.947.219-1.247.437l-.04-.364H13.54l-.688 4.354h1.506l.479-3.053c.129-.065.323-.154.518-.154.145 0 .267.049.267.267 0 .056-.016.145-.024.218l-.429 2.722h1.498l.478-3.053c.138-.073.324-.154.51-.154.146 0 .268.049.268.267 0 .056-.017.145-.025.218l-.429 2.722h1.499l.461-2.908c.025-.153.049-.388.049-.549 0-.582-.267-.97-1.037-.97Zm-6.871 0c-.575 0-.98.219-1.287.421l-.017-.348H8.962l-.689 4.354H9.78l.478-3.053c.13-.065.324-.154.518-.154.147 0 .268.049.268.242 0 .081-.024.227-.032.299l-.422 2.666h1.499l.462-2.908c.024-.153.049-.388.049-.549 0-.582-.268-.97-1.03-.97Zm-5.631 1.834c.041-.485.413-.824.697-.824.162 0 .299.097.299.291 0 .404-.713.533-.996.533Zm.843-1.834c-1.604 0-2.382 1.39-2.382 2.698 0 1.01.478 1.817 1.814 1.817.527 0 1.07-.113 1.418-.282l.186-1.26c-.494.25-.874.347-1.271.347-.365 0-.64-.194-.64-.687.826-.008 2.252-.347 2.252-1.453 0-.687-.494-1.18-1.377-1.18Zm-4.239.267c.089.186.146.412.146.743 0 .606-.429 1.494-.777 2.06l-.373-2.989L0 9.969l.705 4.2h1.757c.77-1.01 1.718-2.448 1.718-3.554 0-.347-.073-.622-.235-.889l-1.402.283Z" fill="#fff"/></g></svg>',
  'cashapp': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#00D632"/><g transform="translate(222,82) scale(14)"><path d="M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z" fill="#fff"/></g></svg>',
  'bitcoin': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#F7931A"/><g transform="translate(222,82) scale(14)"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" fill="#fff"/></g></svg>',
  'wechat-pay': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#07C160"/><g transform="translate(222,82) scale(14)"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" fill="#fff"/></g></svg>',
  'alipay': '<svg viewBox="0 0 780 500" width="42" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#1677FF"/><path d="M114.3 258c-4.8.6-13.2 2.4-18 6.6C82.8 277.2 90.3 299.4 119.7 299.4c16.8 0 33.6-10.8 46.8-27.6-19.2-9-34.8-15.6-52.2-13.8z" fill="#fff"/><path d="M221.8 273.4c27 9 33 9.6 33 9.6v-96c0-16.2-13.2-29.4-30-29.4H98.8c-16.2 0-30 13.2-30 29.4v126c0 16.2 13.2 29.4 30 29.4h126c16.2 0 30-13.2 30-29.4v-1.2s-48-19.8-72.6-31.8c-16.2 19.8-37.2 32.4-59.4 32.4-37.2 0-49.8-32.4-31.8-53.4 3.6-4.8 10.2-9 20.4-11.4 15.6-3.6 40.8 2.4 64.2 10.2 4.2-7.8 7.8-16.2 10.2-25.2h-72.6v-7.2h37.2v-14.4h-45.6v-7.2h45.6v-18.6s0-3 3-3h18v22.2h45v6.6h-45v13.2h36.6c-3.6 14.4-9 27.6-15.6 39 12 4.2 22.2 7.8 29.4 10.2z" fill="#fff"/></svg>',
};


// ─── Types ──────────────────────────────────────────────────────────────────

interface AddonDimension {
  key: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'checkboxes' | 'toggle';
  testable: boolean;
  options?: { value: string; label: string }[];
  checkboxOptions?: { value: string; label: string }[];
  default: any;
  min?: number;
  max?: number;
  placeholder?: string;
}

interface AddonDefinition {
  key: string;
  label: string;
  icon: string;
  description: string;
  estimatedImpact: string;
  impactMetric: string;
  dimensions: AddonDimension[];
  defaultConfig: Record<string, any>;
}

interface AddonState {
  enabled: boolean;
  mode: 'off' | 'locked' | 'auto-optimize';
  config: Record<string, any>;
  optimizeState: {
    queuePosition: number;
    step?: number;
    totalSteps?: number;
    status?: string;
  } | null;
  results: any;
}

// ─── ModeToggle Component ───────────────────────────────────────────────────

function CapsuleToggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  // Inject spinner keyframes
  if (typeof document !== 'undefined' && !document.getElementById('smart-optimize-styles')) {
    const style = document.createElement('style');
    style.id = 'smart-optimize-styles';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg) } }';
    document.head.appendChild(style);
  }

  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: on ? '#22c55e' : '#d1d5db',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: 10,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function AddonsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}><div style={{ fontSize: 16, color: '#6b7280' }}>Loading addons...</div></div>}>
      <AddonsPage />
    </Suspense>
  );
}

function AddonsPage() {
  const { storeId: STORE_ID, loading: storeLoading, error: storeError } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── DEMO / LIVE config target ───────────────────────────────────────────
  // Demo mode only available on localhost — production always uses live
  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [configTarget, setConfigTarget] = useState<'demo' | 'live'>(isLocalDev ? 'demo' : 'live');
  const [promoting, setPromoting] = useState(false);

  const [addons, setAddons] = useState<Record<string, AddonState>>({});
  const [definitions, setDefinitions] = useState<AddonDefinition[]>([]);
  const [optimizeQueue, setOptimizeQueue] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState<'edit' | 'results'>('edit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const saveToastTimer = useRef<any>(null);
  const [themeSettings, setThemeSettings] = useState<Record<string, any> | null>(null);
  const [startingTest, setStartingTest] = useState<Record<string, boolean>>({});

  // ── Autopilot state ──────────────────────────────────────────────────────
  const [autopilot, setAutopilot] = useState<{
    enabled: boolean;
    queue: string[];
    completedCount: number;
    totalLift: number;
    currentTestSlot?: string;
  } | null>(null);
  const [autopilotLoading, setAutopilotLoading] = useState(false);

  // ── Post-winner modal state ──────────────────────────────────────────────
  const [winnerModal, setWinnerModal] = useState<{
    experimentId: string;
    experimentName: string;
    slot: string;
    expectedLoss: number | null;
    liftPercent: number;
    winnerLabel: string;
  } | null>(null);
  const [winnerActionLoading, setWinnerActionLoading] = useState(false);

  // ── Edit-triggers-test modal state ───────────────────────────────────────
  const [editTestModal, setEditTestModal] = useState<{
    type: 'suggest-test' | 'hard-block';
    addonKey: string;
    addonLabel: string;
    runningTestName?: string;
    pendingData?: any;
  } | null>(null);

  // ── Time estimate state (per experiment) ────────────────────────────────
  const [timeEstimates, setTimeEstimates] = useState<Record<string, {
    estimatedDaysRemaining: number;
    dailyEventRate: number;
    requiredSamples: number;
    currentSamples: number;
  }>>({});

  // ── Store traffic stats (for pre-test time estimates) ─────────────────
  const [storeStats, setStoreStats] = useState<{ dailyCartOpens: number; checkoutRate: number } | null>(null);

  // ── Experiment data for timeline notes ──────────────────────────────────
  const [experiments, setExperiments] = useState<Record<string, any>>({});
  const [dailyTraffic, setDailyTraffic] = useState(0);
  const [logEventInput, setLogEventInput] = useState<Record<string, string>>({});
  const [showLogEvent, setShowLogEvent] = useState<Record<string, boolean>>({});

  // ── Data fetching ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        API + '/api/stores/' + STORE_ID + '/addons?target=' + configTarget,
      );
      if (res.ok) {
        const json = await res.json();
        setAddons(json.addons ?? {});
        setDefinitions(json.definitions ?? []);
        setOptimizeQueue(json.optimizeQueue ?? []);
      }
    } catch (e) {
      console.error('Failed to load addons', e);
    } finally {
      setLoading(false);
    }
  }, [STORE_ID, configTarget]);

  const fetchExperiments = useCallback(async () => {
    if (!STORE_ID) return;
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons/experiments');
      if (res.ok) {
        const json = await res.json();
        setExperiments(json.experiments ?? {});
        if (json.dailyTraffic) setDailyTraffic(json.dailyTraffic);
      }
    } catch (e) {
      console.error('Failed to load experiments', e);
    }
  }, [STORE_ID]);

  // fetchExperiments runs inside the unified refresh below

  useEffect(() => {
    if (!STORE_ID) return;
    fetch('/api/stores/' + STORE_ID + '/theme-settings')
      .then(r => r.json())
      .then(d => { if (d.themeSettings) setThemeSettings(d.themeSettings); })
      .catch(() => {});
  }, [STORE_ID]);

  // ── Fetch autopilot state ───────────────────────────────────────────────
  const loadAutopilot = useCallback(async () => {
    if (!STORE_ID) return;
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/autopilot');
      if (res.ok) {
        const json = await res.json();
        setAutopilot(json.autopilot);
      }
    } catch (e) { console.error('Failed to load autopilot', e); }
  }, [STORE_ID]);

  // ── Fetch experiments for time estimates + timeline ──────────────────────
  const loadExperiments = useCallback(async () => {
    if (!STORE_ID) return;
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons/experiments');
      if (res.ok) {
        const json = await res.json();
        const exps = json.experiments || [];
        setExperiments(exps);
        const estimates: Record<string, any> = {};
        for (const exp of exps) {
          if (exp.estimatedDaysRemaining != null) {
            estimates[exp.id] = {
              estimatedDaysRemaining: exp.estimatedDaysRemaining,
              dailyEventRate: exp.dailyEventRate || 0,
              requiredSamples: exp.requiredSamples || 0,
              currentSamples: exp.currentSamples || 0,
            };
          }
        }
        setTimeEstimates(estimates);
      }
    } catch (e) { console.error('Failed to load experiments', e); }
  }, [STORE_ID]);


  const fetchStoreStats = useCallback(async () => {
    if (!STORE_ID) return;
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/stats');
      if (res.ok) {
        const json = await res.json();
        const weeklyOpens = json.last7Days?.cartOpens ?? 0;
        const ownDaily = Math.round(weeklyOpens / 7);
        const rate = parseFloat(json.last7Days?.checkoutRate ?? '0') / 100;

        // Use Shopify historical data when our own tracking is thin
        if (ownDaily < 10 && json.shopifyEstimate?.dailyCartOpens > 0) {
          const se = json.shopifyEstimate;
          const shopifyRate = se.dailyOrders > 0 ? se.dailyOrders / se.dailyCartOpens : 0.04;
          setStoreStats({ dailyCartOpens: se.dailyCartOpens, checkoutRate: shopifyRate });
        } else {
          setStoreStats({ dailyCartOpens: ownDaily, checkoutRate: rate });
        }
      }
    } catch (e) { console.error('Failed to fetch store stats', e); }
  }, [STORE_ID]);

  // ── Unified refresh: load everything on mount + every 15s ────────────────
  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadAutopilot(), loadExperiments(), fetchExperiments(), fetchStoreStats()]);
  }, [load, loadAutopilot, loadExperiments, fetchExperiments, fetchStoreStats]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // ── Restore edit view from URL param on mount (once only) ──────────────
  const didRestoreFromUrl = useRef(false);
  useEffect(() => {
    if (didRestoreFromUrl.current) return;
    let editKey = searchParams.get('edit');
    if (editKey === 'rewards') editKey = 'freeShippingBar';
    if (editKey && definitions.length > 0) {
      const def = definitions.find(d => d.key === editKey);
      if (def) {
        setExpanded(editKey);
        setExpandedView('edit');
        didRestoreFromUrl.current = true;
      }
    }
  }, [searchParams, definitions]);

  // ── Early returns (MUST be after all hooks) ────────────────────────────
  if (storeLoading) return <div style={{padding: 40, textAlign: 'center'}}>Loading store...</div>;
  if (storeError || !STORE_ID) return <div style={{padding: 40, textAlign: 'center', color: '#ef4444'}}>Store not found. Please install the app from Shopify.</div>;

  // ── Autopilot toggle ────────────────────────────────────────────────────

  async function toggleAutopilot(enabled: boolean) {
    if (!STORE_ID) return;
    setAutopilotLoading(true);
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/autopilot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const json = await res.json();
        setAutopilot(json.autopilot);
      }
    } catch (e) { console.error('Failed to toggle autopilot', e); }
    finally { setAutopilotLoading(false); }
  }

  // ── Post-winner actions ────────────────────────────────────────────────

  async function applyWinner(experimentId: string) {
    if (!STORE_ID) return;
    setWinnerActionLoading(true);
    try {
      await fetch(API + '/api/stores/' + STORE_ID + '/addons/test/apply-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experimentId }),
      });
      setWinnerModal(null);
      load();
      loadExperiments();
    } catch (e) { console.error('Failed to apply winner', e); }
    finally { setWinnerActionLoading(false); }
  }

  // ── Log user event to experiment timeline ──────────────────────────────

  async function logUserEvent(experimentId: string) {
    if (!STORE_ID) return;
    const note = logEventInput[experimentId]?.trim();
    if (!note) return;
    try {
      await fetch(API + '/api/stores/' + STORE_ID + '/experiments/' + experimentId + '/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      setLogEventInput(prev => ({ ...prev, [experimentId]: '' }));
      setShowLogEvent(prev => ({ ...prev, [experimentId]: false }));
      loadExperiments();
    } catch (e) { console.error('Failed to log event', e); }
  }

  // ── Edit-triggers-test: intercept save ─────────────────────────────────

  // ── Start/stop optimization ────────────────────────────────────────────────

  async function startTest(addonKey: string, dimensionKey?: string) {
    if (!STORE_ID) return;
    setStartingTest(s => ({ ...s, [addonKey]: true }));
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonKey, dimensionKey }),
      });
      if (res.ok) {
        await fetchExperiments();
        // Auto-switch to results view to show the running test
        setExpanded(addonKey);
        setExpandedView('results');
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (e) {
      console.error('Failed to start test', e);
    } finally {
      // Small delay so the animation completes smoothly
      setTimeout(() => setStartingTest(s => ({ ...s, [addonKey]: false })), 300);
    }
  }

  async function stopTest(addonKey: string) {
    if (!STORE_ID) return;
    const first = confirm('Are you sure you want to stop this test? You can resume it later.');
    if (!first) return;
    const second = confirm('This will pause the experiment. Confirm to proceed.');
    if (!second) return;
    try {
      const res = await fetch(
        API + '/api/stores/' + STORE_ID + '/addons/test?addonKey=' + addonKey,
        { method: 'DELETE' },
      );
      if (res.ok) {
        await fetchExperiments();
      }
    } catch (e) {
      console.error('Failed to stop test', e);
    }
  }

  async function resumeTest(addonKey: string) {
    if (!STORE_ID) return;
    try {
      const res = await fetch(
        API + '/api/stores/' + STORE_ID + '/addons/test?addonKey=' + addonKey,
        { method: 'PATCH' },
      );
      if (res.ok) {
        await fetchExperiments();
      }
    } catch (e) {
      console.error('Failed to resume test', e);
    }
  }

  // Optimistic config update — updates local state immediately, then syncs to API
  function updateAddonConfig(key: string, configPatch: Record<string, any>) {
    // Immediate local update for instant preview
    setAddons(prev => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          config: { ...current.config, ...configPatch },
        },
      };
    });
    // Then persist to API
    patchAddon(key, { config: configPatch });
  }

  async function patchAddonWithSafety(key: string, data: any) {
    if (!STORE_ID) return;
    const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons?target=' + configTarget, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addonKey: key, ...data }),
    });
    if (res.status === 409) {
      // Hard block — active test on same slot
      const json = await res.json();
      const def = definitions.find(d => d.key === key);
      setEditTestModal({
        type: 'hard-block',
        addonKey: key,
        addonLabel: def?.label || key,
        runningTestName: json.runningTest,
        pendingData: data,
      });
      return;
    }
    const json = await res.json();
    if (json.changeRisk === 'medium') {
      // Soft warning — show but proceed
      console.log('Medium risk change applied:', json);
    }
    setAddons(json.addons ?? {});
    setOptimizeQueue(json.optimizeQueue ?? []);
    loadExperiments();
  }

  async function forceAddonSave(key: string, data: any, options?: { pauseTest?: boolean; resetTest?: boolean }) {
    if (!STORE_ID) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons?target=' + configTarget, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addonKey: key, ...data, force: true,
          pauseTest: options?.pauseTest,
          resetTest: options?.resetTest,
        }),
      });
      const json = await res.json();
      setAddons(json.addons ?? {});
      setOptimizeQueue(json.optimizeQueue ?? []);
      setEditTestModal(null);
      loadExperiments();
    } catch (e) { console.error('Failed to force save', e); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  }

  // ── API helpers ─────────────────────────────────────────────────────────

  function showSaveToast(msg = 'Saved!') {
    setSaveToast(msg);
    if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
    saveToastTimer.current = setTimeout(() => setSaveToast(null), 2200);
  }

  async function patchAddon(key: string, data: any) {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons?target=' + configTarget, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonKey: key, ...data }),
      });
      const json = await res.json();
      setAddons(json.addons ?? {});
      setOptimizeQueue(json.optimizeQueue ?? []);
      showSaveToast();
    } catch (e) {
      console.error('Failed to patch addon', e);
      showSaveToast('Save failed!');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function applyRecommended() {
    setLoading(true);
    try {
      const res = await fetch(
        API + '/api/stores/' + STORE_ID + '/addons/apply-recommended',
        { method: 'POST' },
      );
      if (res.ok) {
        await load();
      }
    } catch (e) {
      console.error('Failed to apply recommended', e);
    } finally {
      setLoading(false);
    }
  }

  function handleModeChange(key: string, newMode: string) {
    if (newMode === 'off') {
      patchAddon(key, { enabled: false, mode: 'off' });
    } else if (newMode === 'auto-optimize') {
      patchAddon(key, { enabled: true, mode: 'auto-optimize' });
    } else if (newMode === 'locked') {
      patchAddon(key, { enabled: true, mode: 'locked' });
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────

  const activeCount = Object.values(addons).filter((a) => a.enabled).length;
  const optimizingCount = Object.values(addons).filter(
    (a) => a.mode === 'auto-optimize',
  ).length;
  const allDisabled = activeCount === 0 && definitions.length > 0;

  // Sort: enabled first (auto-optimize > locked > on), then disabled
  const sortedDefs = [...definitions].sort((a, b) => {
    const aa = addons[a.key];
    const bb = addons[b.key];
    const scoreA = !aa?.enabled
      ? 0
      : aa.mode === 'auto-optimize'
        ? 3
        : aa.mode === 'locked'
          ? 2
          : 1;
    const scoreB = !bb?.enabled
      ? 0
      : bb.mode === 'auto-optimize'
        ? 3
        : bb.mode === 'locked'
          ? 2
          : 1;
    return scoreB - scoreA;
  });

  // ── Render helpers ────────────────────────────────────────────────────

  function renderDimensionControl(
    addonKey: string,
    dim: AddonDimension,
    config: Record<string, any>,
  ) {
    const val = config[dim.key] ?? dim.default;
    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '8px 12px',
      background: '#fafafa',
      border: '1px solid #d1d5db',
      borderRadius: 6,
      color: '#111827',
      fontSize: 13,
      boxSizing: 'border-box' as const,
    };

    switch (dim.type) {
      case 'select':
        return (
          <select
            value={val}
            onChange={(e) =>
              updateAddonConfig(addonKey, { [dim.key]: e.target.value })
            }
            style={inputStyle}
          >
            {(dim.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'text':
        return (
          <input
            type="text"
            value={val ?? ''}
            placeholder={dim.placeholder}
            onChange={(e) =>
              updateAddonConfig(addonKey, { [dim.key]: e.target.value })
            }
            style={inputStyle}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={val ?? ''}
            min={dim.min}
            max={dim.max}
            placeholder={dim.placeholder}
            onChange={(e) =>
              updateAddonConfig(addonKey, { [dim.key]: Number(e.target.value) })
            }
            style={inputStyle}
          />
        );

      case 'toggle':
        return (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) =>
                updateAddonConfig(addonKey, { [dim.key]: e.target.checked })
              }
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, color: '#374151' }}>
              {val ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        );

      case 'checkboxes': {
        const current: string[] = Array.isArray(val) ? val : [];
        const opts = dim.checkboxOptions ?? dim.options ?? [];
        const showSearch = opts.length > 8;
        const SearchableCheckboxes = () => {
          const [q, setQ] = useState('');
          const [dragIdx, setDragIdx] = useState<number | null>(null);
          const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

          const filtered = q
            ? opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
            : opts;
          // Sort: selected first (preserve drag order within selected), then unselected
          const sorted = [...filtered].sort((a, b) => {
            const aS = current.includes(a.value) ? 0 : 1;
            const bS = current.includes(b.value) ? 0 : 1;
            if (aS !== bS) return aS - bS;
            if (aS === 0) return current.indexOf(a.value) - current.indexOf(b.value);
            return 0;
          });

          function handleDragStart(idx: number) { setDragIdx(idx); }
          function handleDragOver(e: React.DragEvent, idx: number) {
            e.preventDefault();
            setDragOverIdx(idx);
          }
          function handleDrop(idx: number) {
            if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
            const item = sorted[dragIdx];
            const target = sorted[idx];
            if (!current.includes(item.value) || !current.includes(target.value)) {
              setDragIdx(null); setDragOverIdx(null); return;
            }
            // Reorder within current
            const reordered = [...current];
            const fromI = reordered.indexOf(item.value);
            const toI = reordered.indexOf(target.value);
            reordered.splice(fromI, 1);
            reordered.splice(toI, 0, item.value);
            updateAddonConfig(addonKey, { [dim.key]: reordered });
            setDragIdx(null);
            setDragOverIdx(null);
          }

          return (
            <div>
              {showSearch && (
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search payment methods..."
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    marginBottom: 8,
                    background: '#fff',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#111827',
                    boxSizing: 'border-box' as const,
                    outline: 'none',
                  }}
                />
              )}
              {current.length > 1 && (
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>
                  Drag selected items to reorder
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap' as const,
                  gap: 6,
                  maxHeight: opts.length > 12 ? 220 : undefined,
                  overflowY: opts.length > 12 ? 'auto' as const : undefined,
                  paddingRight: opts.length > 12 ? 4 : 0,
                }}
              >
                {sorted.map((opt, idx) => {
                  const checked = current.includes(opt.value);
                  const svgHtml = PAYMENT_ICON_SVGS[opt.value];
                  const isDragging = dragIdx === idx;
                  const isDragOver = dragOverIdx === idx && dragIdx !== idx;
                  return (
                    <div
                      key={opt.value}
                      draggable={checked}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      onDrop={() => handleDrop(idx)}
                      onClick={() => {
                        const next = checked
                          ? current.filter((v) => v !== opt.value)
                          : [...current, opt.value];
                        updateAddonConfig(addonKey, { [dim.key]: next });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: checked ? 'grab' : 'pointer',
                        fontSize: 11,
                        color: checked ? '#1e40af' : '#374151',
                        padding: '5px 8px',
                        background: checked ? '#eff6ff' : '#f9fafb',
                        border: '2px solid ' + (isDragOver ? '#60a5fa' : checked ? '#3b82f6' : '#e5e7eb'),
                        borderRadius: 8,
                        transform: isDragging ? 'scale(1.05)' : checked ? 'scale(1)' : 'scale(0.98)',
                        opacity: isDragging ? 0.6 : 1,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        userSelect: 'none' as const,
                        boxShadow: checked ? '0 1px 3px rgba(59,130,246,0.15)' : 'none',
                      }}
                    >
                      {svgHtml ? (
                        <span dangerouslySetInnerHTML={{ __html: svgHtml }} />
                      ) : (
                        <span style={{ fontWeight: checked ? 600 : 400 }}>{opt.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        };
        return <SearchableCheckboxes />;
      }

      default:
        return null;
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
        }}
      >
        <div style={{ fontSize: 16, color: '#6b7280' }}>
          Loading addons...
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        color: '#111827',
        padding: '24px 32px',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {/* Global save toast */}
      {saveToast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, padding: '10px 24px', background: saveToast.includes('fail') ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (saveToast.includes('fail') ? '#fca5a5' : '#86efac'), borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 8, animation: 'toastIn 0.3s ease-out' }}>
          <span style={{ fontSize: 14 }}>{saveToast.includes('fail') ? '\u274c' : '\u2705'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: saveToast.includes('fail') ? '#991b1b' : '#166534' }}>{saveToast}</span>
        </div>
      )}
      <style>{`@keyframes toastIn { from { transform: translateX(80px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                margin: 0,
                color: '#111827',
              }}
            >
              Cart Addons
            </h1>
            <p
              style={{
                color: '#9ca3af',
                margin: '4px 0 0',
                fontSize: 13,
              }}
            >
              Toggle features on/off. Auto-Optimize lets AI test variations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                background: activeCount > 0 ? '#dcfce7' : '#f3f4f6',
                color: activeCount > 0 ? '#166534' : '#6b7280',
                borderRadius: 20,
              }}
            >
              {activeCount} active
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                background: optimizingCount > 0 ? '#f0fdf4' : '#f3f4f6',
                color: optimizingCount > 0 ? '#15803d' : '#6b7280',
                borderRadius: 20,
              }}
            >
              {optimizingCount} optimizing
            </span>
          </div>
        </div>

        {/* ── DEMO / LIVE config toggle (localhost only) ──────────────── */}
        {isLocalDev && (<div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
          padding: '10px 16px', background: configTarget === 'demo' ? '#fefce8' : '#f0fdf4',
          border: '1px solid ' + (configTarget === 'demo' ? '#fde68a' : '#86efac'),
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', background: '#e5e7eb', borderRadius: 8, padding: 2 }}>
            {(['demo', 'live'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setConfigTarget(t); setLoading(true); }}
                style={{
                  padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                  border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: configTarget === t ? (t === 'demo' ? '#f59e0b' : '#22c55e') : 'transparent',
                  color: configTarget === t ? '#fff' : '#6b7280',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {configTarget === 'demo'
              ? 'Editing DEMO config \u2014 changes only affect the demo theme'
              : 'Editing LIVE config \u2014 changes affect your live store'}
          </span>
          {configTarget === 'demo' && (
            <button
              onClick={async () => {
                if (!STORE_ID || promoting) return;
                if (!confirm('Push all DEMO settings to LIVE? This will update your real store.')) return;
                setPromoting(true);
                try {
                  await fetch(API + '/api/stores/' + STORE_ID + '/addons/promote-demo', { method: 'POST' });
                  showSaveToast('Demo promoted to Live!');
                } catch (e) { showSaveToast('Promote failed!'); }
                finally { setPromoting(false); }
              }}
              disabled={promoting}
              style={{
                marginLeft: 'auto', padding: '6px 16px', fontSize: 12, fontWeight: 600,
                background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
                cursor: promoting ? 'wait' : 'pointer', opacity: promoting ? 0.6 : 1,
              }}
            >
              {promoting ? 'Pushing...' : 'Push to Live'}
            </button>
          )}
        </div>)}

        {/* ── Recommended Setup Banner ─────────────────────────────── */}
        {allDisabled && (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: 0,
                  color: '#111827',
                }}
              >
                Get started fast
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: '#6b7280',
                  margin: '4px 0 0',
                }}
              >
                Enable Trust Badges + Rewards + Scarcity Timer with
                Auto-Optimize
              </p>
            </div>
            <button
              onClick={applyRecommended}
              style={{
                padding: '9px 20px',
                background: '#22c55e',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: 'nowrap' as const,
              }}
            >
              Apply Recommended
            </button>
          </div>
        )}

        {/* ── Autopilot Banner ───────────────────────────────────── */}
        <div
          style={{
            background: autopilot?.enabled ? 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' : '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            border: '1px solid ' + (autopilot?.enabled ? '#86efac' : '#e5e7eb'),
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{autopilot?.enabled ? '🤖' : '🔄'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                  Autopilot Mode
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {autopilot?.enabled
                    ? `Running — ${autopilot.completedCount || 0} tests done, +${((autopilot.totalLift || 0)).toFixed(1)}% total improvement so far`
                    : 'Automatically tests each feature for quick wins, then fine-tunes the winners'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {autopilot?.enabled && autopilot.queue && autopilot.queue.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 500, color: '#6b7280',
                  background: '#f3f4f6', padding: '3px 10px', borderRadius: 12,
                }}>
                  {autopilot.queue.length} tests queued
                </span>
              )}
              <CapsuleToggle
                on={!!autopilot?.enabled}
                onChange={(on) => toggleAutopilot(on)}
                disabled={autopilotLoading}
              />
            </div>
          </div>
          {autopilot?.enabled && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
              {/* Phase indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 10px', borderRadius: 8 }}>
                  Phase 1: Quick Sweep
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  Testing each feature ON vs OFF for fast wins
                </div>
              </div>

              {/* Optimization roadmap */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {/* Currently testing */}
                {autopilot.queue && autopilot.queue.length > 0 && (() => {
                  const current = autopilot.queue[0];
                  const parts = current.split(':');
                  const addonKey = parts[0];
                  const dim = parts[1] || 'enabled';
                  const def = definitions.find((d: any) => d.key === addonKey);
                  const exp = experiments[addonKey];
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                      <span style={{ fontSize: 14 }}>{def?.icon || '🔬'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>
                          Now testing: {def?.label || addonKey} {dim === 'enabled' ? 'ON vs OFF' : dim}
                        </div>
                        {exp && (
                          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                            {exp.totalVisitors} visitors · {Math.round(Math.max(0, ((exp.confidence || 0) - 0.5) / 0.5) * 100)}% confidence
                          </div>
                        )}
                      </div>
                      <div style={{ width: 60, height: 4, background: '#bbf7d0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: Math.max(Math.round(Math.max(0, ((exp?.confidence || 0) - 0.5) / 0.5) * 100), 2) + '%', background: '#16a34a', borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Up next items */}
                {autopilot.queue && autopilot.queue.slice(1, 4).map((item: string, idx: number) => {
                  const parts = item.split(':');
                  const addonKey = parts[0];
                  const dim = parts[1] || 'enabled';
                  const def = definitions.find((d: any) => d.key === addonKey);
                  return (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                      <span style={{ fontSize: 14, opacity: 0.5 }}>{def?.icon || '🔬'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>
                          {def?.label || addonKey} {dim === 'enabled' ? 'ON vs OFF' : dim}
                        </div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>
                          Expected impact: {def?.estimatedImpact || 'TBD'}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>#{idx + 2}</span>
                    </div>
                  );
                })}

                {autopilot.queue && autopilot.queue.length > 4 && (
                  <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 12px' }}>
                    +{autopilot.queue.length - 4} more tests queued
                  </div>
                )}
              </div>

              {/* Completed tests summary */}
              {autopilot.completedCount > 0 && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed' }}>
                    Results so far: {autopilot.completedCount} tests completed → +{(autopilot.totalLift || 0).toFixed(1)}% total improvement
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Addon Cards ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 12,
          }}
        >
          {sortedDefs.map((def) => {
            const addon: AddonState = addons[def.key] ?? {
              enabled: false,
              mode: 'off',
              config: { ...def.defaultConfig },
              optimizeState: null,
              results: null,
            };
            const isExpanded = expanded === def.key;
            const isSaving = saving[def.key] ?? false;

            const borderColor =
              addon.mode === 'auto-optimize'
                ? '#22c55e'
                : addon.mode === 'locked'
                  ? '#111827'
                  : '#e5e7eb';
            const borderWidth =
              addon.mode === 'auto-optimize' || addon.mode === 'locked'
                ? 2
                : 1;

            const activeExp = experiments[def.key];
            const isTesting = activeExp?.status === 'RUNNING';
            const hasWinner = activeExp?.status === 'WINNER_FOUND';
            const badgeColor = isTesting ? '#7c3aed' : hasWinner ? '#16a34a' : addon.enabled ? '#7c3aed' : '#9ca3af';
            const badgeLabel = isTesting ? 'Smart Optimizing' : hasWinner ? 'Winner Found' : addon.enabled ? 'Active' : 'Off';

            return (
              <div
                key={def.key}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: borderWidth + 'px solid ' + borderColor,
                  padding: 16,
                  opacity: 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* ── Collapsed Row ──────────────────────────────── */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: 24, flexShrink: 0 }}>
                    {def.icon}
                  </span>

                  {/* Name + badge + impact */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        {def.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: badgeColor + '18',
                          color: badgeColor,
                          textTransform: 'uppercase' as const,
                          letterSpacing: 0.3,
                        }}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#9ca3af',
                        marginTop: 2,
                      }}
                    >
                      {def.description}
                    </div>
                    {isTesting && activeExp && (
                      <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 500, marginTop: 3 }}>
                        {activeExp.totalVisitors} visitors tested
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {(isTesting || hasWinner || (activeExp?.status === 'NO_DIFFERENCE')) && (
                      <button
                        onClick={() => {
                          if (isExpanded && expandedView === 'results') { setExpanded(null); }
                          else { setExpanded(def.key); setExpandedView('results'); }
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600, color: '#7c3aed',
                          padding: '4px 8px',
                        }}
                      >
                        {isExpanded && expandedView === 'results' ? 'Close' : 'Track Results'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (isExpanded && expandedView === 'edit') { setExpanded(null); }
                        else { setExpanded(def.key); setExpandedView('edit'); }
                        const urlKey = def.key === 'freeShippingBar' ? 'rewards' : def.key;
                        const url = isExpanded && expandedView === 'edit' ? window.location.pathname : '?edit=' + urlKey;
                        window.history.replaceState({}, '', url);
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 500, color: '#6b7280',
                        padding: '4px 8px',
                      }}
                    >
                      {isExpanded && expandedView === 'edit' ? 'Collapse' : 'Edit'}
                    </button>
                  </div>

                  {/* 3-way toggle */}
                  <CapsuleToggle
                    on={addon.enabled}
                    onChange={(on) => handleModeChange(def.key, on ? 'locked' : 'off')}
                    disabled={isSaving}
                  />
                </div>

                {/* ── Expanded Edit Section ─────────────────────── */}
                {isExpanded && expandedView === 'edit' && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: '1px solid #f3f4f6',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 24,
                    }}
                  >
                    {/* Left: Cart Preview */}
                    <AddonPreview
                      addonKey={def.key}
                      addonConfig={addon.config ?? {}}
                      mode="full"
                    />

                    {/* Right: Edit controls */}
                    <div>
                      {/* Rewards addon gets the custom tier editor with Save/Discard */}
                      {def.key === 'freeShippingBar' && (
                        <RewardsTierEditorWithSave
                          savedConfig={addon.config ?? {}}
                          onSave={(fullConfig) => updateAddonConfig(def.key, fullConfig)}
                          onPreviewChange={(draftConfig) => {
                            // Update preview instantly without persisting
                            setAddons(prev => {
                              const current = prev[def.key];
                              if (!current) return prev;
                              return { ...prev, [def.key]: { ...current, config: draftConfig } };
                            });
                          }}
                          storeId={STORE_ID}
                        />
                      )}

                      {/* Standard dimensions (for rewards, only position remains) */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column' as const,
                          gap: 14,
                          marginTop: def.key === 'freeShippingBar' ? 16 : 0,
                        }}
                      >
                        {def.dimensions.map((dim) => (
                          <div key={dim.key}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 4,
                              }}
                            >
                              <label
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: '#374151',
                                }}
                              >
                                {dim.label}
                              </label>
                              {!dim.testable && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 6px',
                                    borderRadius: 8,
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    fontWeight: 500,
                                  }}
                                >
                                  Never optimized
                                </span>
                              )}
                            </div>
                            {renderDimensionControl(
                              def.key,
                              dim,
                              addon.config,
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Start Optimize button — with clear description */}
                      {addon.enabled && !experiments[def.key]?.status && def.dimensions.some(d => d.testable) && (
                        <div style={{ marginTop: 20 }}>
                          <div style={{ padding: 14, background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 10, marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#6d28d9', marginBottom: 6 }}>
                              What this optimization will do:
                            </div>
                            <div style={{ fontSize: 12, color: '#7c3aed', lineHeight: 1.5 }}>
                              Our AI will find whether <strong>{def.label}</strong> increases your checkout rate. Results appear automatically — the more visitors, the faster.
                            </div>
                            <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 6 }}>
                              Once complete, our AI can fine-tune individual settings for even more lift.
                            </div>
                          </div>
                          <button
                            onClick={() => startTest(def.key)}
                            disabled={!!startingTest[def.key]}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '12px 20px',
                              background: startingTest[def.key]
                                ? 'linear-gradient(135deg, #a78bfa, #8b5cf6)'
                                : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                              color: '#fff', border: 'none', borderRadius: 10,
                              cursor: startingTest[def.key] ? 'default' : 'pointer',
                              fontWeight: 600, fontSize: 14, width: '100%', justifyContent: 'center',
                              boxShadow: startingTest[def.key]
                                ? '0 2px 12px rgba(124,58,237,0.4)'
                                : '0 2px 8px rgba(124,58,237,0.3)',
                              transition: 'all 0.3s ease',
                              transform: startingTest[def.key] ? 'scale(0.98)' : 'scale(1)',
                            }}
                          >
                            {startingTest[def.key] ? (
                              <>
                                <span style={{
                                  display: 'inline-block', width: 16, height: 16,
                                  border: '2px solid rgba(255,255,255,0.3)',
                                  borderTopColor: '#fff',
                                  borderRadius: '50%',
                                  animation: 'spin 0.6s linear infinite',
                                }} />
                                Setting up optimization…
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: 16 }}>✨</span>
                                Smart Optimize
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      {addon.enabled && experiments[def.key]?.status === 'RUNNING' && (
                        <div style={{ marginTop: 16, padding: 14, background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 2s infinite' }} />
                            <div style={{ fontSize: 13, color: '#6d28d9', fontWeight: 600 }}>
                              Smart Optimizing…
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 12 }}>
                            {def.label} ON vs OFF · {experiments[def.key]?.totalVisitors ?? 0} visitors so far
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => stopTest(def.key)}
                              style={{
                                flex: 1, padding: '8px 16px', background: '#fff', color: '#dc2626',
                                border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              Stop Test
                            </button>
                            <button
                              onClick={() => { setExpandedView('results'); }}
                              style={{
                                flex: 1, padding: '8px 16px', background: '#7c3aed', color: '#fff',
                                border: 'none', borderRadius: 8, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              View Results
                            </button>
                          </div>
                        </div>
                      )}
                      {addon.enabled && experiments[def.key]?.status === 'PAUSED' && (
                        <div style={{ marginTop: 16, padding: 14, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
                            <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                              Test Paused
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#a16207', marginBottom: 12 }}>
                            {experiments[def.key]?.totalVisitors ?? 0} visitors collected · Results preserved
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => resumeTest(def.key)}
                              style={{
                                flex: 1, padding: '8px 16px', background: '#7c3aed', color: '#fff',
                                border: 'none', borderRadius: 8, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              Resume Test
                            </button>
                            <button
                              onClick={() => { setExpandedView('results'); }}
                              style={{
                                flex: 1, padding: '8px 16px', background: '#fff', color: '#92400e',
                                border: '1px solid #fde68a', borderRadius: 8, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              View Results
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Results View Section ─────────────────────── */}
                {isExpanded && expandedView === 'results' && (() => {
                  const exp = experiments[def.key];
                  if (!exp) return null;
                  // Transform raw Bayesian confidence (50%=no data, 100%=certain) to user-friendly 0-100% scale
                  const rawConf = exp.confidence ?? 0;
                  const confidence = Math.round(Math.max(0, (rawConf - 0.5) / 0.5) * 100);
                  const testing = exp.status === 'RUNNING';
                  const paused = exp.status === 'PAUSED';
                  const winner = exp.status === 'WINNER_FOUND';
                  const noDiff = exp.status === 'NO_DIFFERENCE';

                  return (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{exp.name}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            {exp.totalVisitors} visitors · Started {new Date(exp.startedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {testing && (
                            <button
                              onClick={() => stopTest(def.key)}
                              style={{ padding: '6px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#6b7280', cursor: 'pointer' }}
                            >
                              Stop Test
                            </button>
                          )}
                          {paused && (
                            <button
                              onClick={() => resumeTest(def.key)}
                              style={{ padding: '6px 14px', background: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                            >
                              Resume Test
                            </button>
                          )}
                          {(winner || noDiff) && (
                            <button
                              onClick={() => startTest(def.key)}
                              disabled={!!startingTest[def.key]}
                              style={{ padding: '6px 14px', background: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                            >
                              Test Next Dimension
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Confidence bar + status */}
                      <div style={{ marginBottom: 20, padding: 14, background: '#f9fafb', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginBottom: 6 }}>
                          <span style={{ fontWeight: 500 }}>Confidence Level</span>
                          <span style={{ fontWeight: 700 }}>{confidence}%</span>
                        </div>
                        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: Math.max(confidence, 2) + '%', background: confidence >= 90 ? '#16a34a' : '#7c3aed', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                          {confidence >= 90
                            ? (winner ? 'Winner confirmed with high confidence!' : 'High confidence — no meaningful difference detected')
                            : confidence >= 60 ? 'Almost there — the engine is narrowing it down'
                            : confidence === 0 ? (testing ? 'Waiting for visitor data...' : paused ? 'Test paused — resume to continue collecting data' : 'No data collected')
                            : testing ? "Learning from your visitors' behavior..." : paused ? 'Test paused — results preserved' : 'Optimization ended'}
                        </div>

                        {/* Status timeline */}
                        {testing && (() => {
                          const totalV = exp.totalVisitors ?? 0;
                          const msRunning = Date.now() - new Date(exp.startedAt).getTime();
                          const hoursRunning = Math.floor(msRunning / 3600000);
                          const daysRunning = msRunning / 86400000;
                          const daysRunningInt = Math.floor(daysRunning);
                          const liftHasData = exp.liftPercent != null;
                          const liftAbs = Math.abs(exp.liftPercent ?? 0);
                          // Smart milestones — derived from observed conversion rate (API calculates)
                          const minPerVariant = exp.explorationMinPerVariant || 30;
                          const numVariants = (exp.variantStats || []).length || 2;
                          const minVisitors = minPerVariant * numVariants; // statistical minimum
                          // Time estimate: how many days to reach min visitors at current traffic rate
                          const daysToMin = dailyTraffic > 0 ? Math.ceil(minVisitors / dailyTraffic) : 7;
                          // For conclusion, we want ~3x minimum for strong confidence
                          const strongTarget = minPerVariant * numVariants * 3;
                          const daysToStrong = dailyTraffic > 0 ? Math.ceil(strongTarget / dailyTraffic) : 14;
                          const etaLabel = dailyTraffic > 0
                            ? (daysToMin <= 1 ? 'less than a day' : daysToMin + ' days')
                            : 'estimating...';

                          // Time remaining for 3-day minimum
                          const hoursLeft = Math.max(0, 72 - hoursRunning);
                          const daysLeft = Math.floor(hoursLeft / 24);
                          const remainingHours = hoursLeft % 24;
                          const timeLeftLabel = hoursLeft <= 0 ? 'Complete'
                            : daysLeft > 0 ? daysLeft + 'd ' + remainingHours + 'h left'
                            : remainingHours + 'h left';
                          const timeRunningLabel = daysRunningInt < 1 ? hoursRunning + 'h' : daysRunningInt + 'd ' + (hoursRunning % 24) + 'h';
                          const past3Days = daysRunningInt >= 3;

                          const steps = [
                            { label: 'Collecting visitors', detail: totalV + '/' + minVisitors + ' visitors (' + minPerVariant + ' per variant)' + (totalV < minVisitors && dailyTraffic > 0 ? ' · ~' + etaLabel + ' left' : ''), done: totalV >= minVisitors, active: totalV < minVisitors },
                            { label: '3-day minimum', detail: timeRunningLabel + ' running · ' + timeLeftLabel, done: past3Days, active: totalV >= minVisitors && !past3Days },
                            { label: 'Detecting impact', detail: liftHasData && liftAbs > 0 ? (liftAbs.toFixed(1) + '% difference so far') : 'Measuring...', done: past3Days && (confidence >= 60 || (liftHasData && totalV >= strongTarget && liftAbs < 3)), active: past3Days && confidence < 60 && !(liftHasData && totalV >= strongTarget && liftAbs < 3) },
                            { label: 'Conclusion', detail: !past3Days ? 'Waiting for 3-day minimum' : confidence >= 90 ? 'Clear winner found!' : (liftHasData && totalV >= strongTarget && liftAbs < 3) ? 'Low impact — ready to move on' : (dailyTraffic > 0 && daysToStrong > daysRunningInt ? '~' + (daysToStrong - daysRunningInt) + ' days at current traffic' : 'Need more data'), done: (confidence >= 90 || winner || noDiff) && past3Days, active: past3Days && confidence >= 60 && confidence < 90 },
                          ];
                          return (
                            <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Test Progress</div>
                              {steps.map((step, si) => (
                                <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: si < steps.length - 1 ? 6 : 0 }}>
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid ' + (step.done ? '#16a34a' : step.active ? '#7c3aed' : '#d1d5db'), background: step.done ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                    {step.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{'✓'}</span>}
                                    {step.active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: step.active ? 600 : 500, color: step.done ? '#16a34a' : step.active ? '#111827' : '#9ca3af' }}>{step.label}</div>
                                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{step.detail}</div>
                                  </div>
                                </div>
                              ))}
                              {liftHasData && totalV >= strongTarget && liftAbs < 3 && (
                                <div style={{ marginTop: 8, padding: 8, background: '#fef3c7', borderRadius: 6, fontSize: 11, color: '#92400e' }}>
                                  {'This feature shows less than 3% impact. The engine will auto-conclude soon so we can test the next dimension.'}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* What's being tested */}
                      <div style={{ marginBottom: 16, padding: 14, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                            What we're testing
                          </div>
                          {testing && exp.trafficSplit && (() => {
                            const splits = Object.values(exp.trafficSplit as Record<string, number>);
                            const maxSplit = Math.max(...splits);
                            const isUnbalanced = maxSplit > 0.65;
                            if (!isUnbalanced) return null;
                            return (
                              <button
                                onClick={async () => {
                                  if (!STORE_ID) return;
                                  await fetch('/api/stores/' + STORE_ID + '/addons/experiments', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ experimentId: exp.id }),
                                  });
                                  fetchExperiments();
                                }}
                                style={{ fontSize: 11, padding: '4px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                              >
                                Rebalance to 50/50
                              </button>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                          Each visitor sees one of these {(exp.variantStats || []).length} versions. The system automatically sends more traffic to the version that converts best.
                        </div>
                      </div>

                      {/* Variant cards with previews */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                        {(exp.variantStats || []).map((v: any, vi: number) => {
                          const isWinnerV = exp.winnerVariantId === v.id;
                          const trafficPct = exp.trafficSplit ? Math.round((exp.trafficSplit[v.id] ?? 0) * 100) : 0;
                          return (
                            <div key={v.id} style={{
                              border: '1px solid ' + (isWinnerV ? '#16a34a' : '#e5e7eb'),
                              borderRadius: 12, overflow: 'hidden',
                              background: isWinnerV ? '#f0fdf4' : '#fff',
                            }}>
                              {/* Variant header */}
                              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>
                                    {String.fromCharCode(65 + vi)}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{v.label}</span>
                                  {isWinnerV && (
                                    <span style={{ fontSize: 10, padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: 8, fontWeight: 700 }}>WINNER</span>
                                  )}
                                </div>
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>{trafficPct}% traffic</span>
                              </div>

                              {/* Stats row */}
                              <div style={{ padding: '0 16px 12px', display: 'flex', gap: 24 }}>
                                <div>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{v.checkoutRate}%</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Checkout Rate</div>
                                </div>
                                {v.purchaseRate !== undefined && (
                                  <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>{v.purchaseRate}%</div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Purchase Rate</div>
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{v.visitors}</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Visitors</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{v.cartOpens}</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Cart Opens</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{v.checkoutClicks}</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Checkouts</div>
                                </div>
                                {v.orders !== undefined && v.orders > 0 && (
                                  <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>{v.orders}</div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Orders</div>
                                  </div>
                                )}
                              </div>

                              {/* Preview of this variant */}
                              <div style={{ borderTop: '1px solid #f3f4f6', padding: 12, background: '#fafafa' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  Preview
                                </div>
                                <AddonPreview
                                  addonKey={v.features?._enabled === false ? '_none' : def.key}
                                  addonConfig={v.features?._enabled === false ? {} : { ...(addon.config ?? {}), ...(v.features || {}) }}
                                  mode="full"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>




                      {/* Lift summary — only show when confidence is meaningful (traffic-independent) */}
                      {(winner || (exp.liftPercent && exp.liftPercent > 0 && confidence >= 60)) && (
                        <div style={{ marginTop: 16, padding: 12, background: winner ? '#f0fdf4' : '#faf5ff', border: '1px solid ' + (winner ? '#bbf7d0' : '#d8b4fe'), borderRadius: 8, textAlign: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: winner ? '#16a34a' : '#7c3aed' }}>
                            {winner ? 'Winner' : 'Leading variant'}: +{(exp.liftPercent ?? 0).toFixed(1)}% conversion lift
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* ── Optimization Queue ───────────────────────────────────── */}
        {optimizeQueue.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 10,
                textTransform: 'uppercase' as const,
                letterSpacing: 0.5,
              }}
            >
              Optimization Queue
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto' as const,
              }}
            >
              {optimizeQueue.map((key, idx) => {
                const def = definitions.find((d) => d.key === key);
                const label = def?.label ?? key;
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 14px',
                      background: idx === 0 ? '#f0fdf4' : '#f9fafb',
                      border:
                        '1px solid ' +
                        (idx === 0 ? '#bbf7d0' : '#e5e7eb'),
                      borderRadius: 8,
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{def?.icon ?? ''}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#374151',
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: idx === 0 ? '#16a34a' : '#9ca3af',
                        background: idx === 0 ? '#dcfce7' : '#f3f4f6',
                        padding: '2px 8px',
                        borderRadius: 12,
                      }}
                    >
                      {idx === 0 ? 'Smart Optimizing' : 'Queue #' + (idx + 1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        <div
          style={{
            marginTop: 32,
            padding: 16,
            textAlign: 'center' as const,
            color: '#d1d5db',
            fontSize: 11,
          }}
        >
          Eliminai Cart Optimizer
        </div>
      </div>
    </div>
  );
}
