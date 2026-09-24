import {
  IncompleteLabelDataError,
  escapeHtml,
  formatFiniteNumber,
  normalizeLabelData,
  resolveCurrentLabelBranding,
  buildLabelHtml,
} from './labelPrintServiceCore.mjs';
import { getCachedCompanyBranding } from '../../settings/services/settingsApi';

export {
  IncompleteLabelDataError,
  escapeHtml,
  formatFiniteNumber,
  normalizeLabelData,
  resolveCurrentLabelBranding,
  buildLabelHtml,
};

/**
 * Dispatches label printing to an isolated document matching the mobile staff
 * printing mechanism (window.open with iframe fallback) to ensure that only the
 * A6 label cards are printed with 100% fidelity, zero host page leakage, and
 * exactly 1 page per parcel sticker.
 */
export function printThermalLabels(labelOrLabels, branding = null, reservedWindow = null) {
  const resolvedBranding = branding || getCachedCompanyBranding();
  const html = buildLabelHtml(labelOrLabels, resolvedBranding);
  if (typeof window === 'undefined') return;

  let printWindow = reservedWindow;
  if (!printWindow) {
    try {
      printWindow = window.open('', '_blank');
    } catch (err) {
      console.warn('window.open was blocked or threw an error:', err);
    }
  }

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (err) {
        console.warn('Print window print error:', err);
      }
    }, 250);
    return;
  }

  // Fallback: hidden iframe if popup was blocked by browser
  try {
    let iframe = document.getElementById('tnl-label-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'tnl-label-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow.focus();
      setTimeout(() => {
        try {
          iframe.contentWindow.print();
        } catch (err) {
          if (window.print) window.print();
        }
      }, 250);
      return;
    }
  } catch (err) {
    console.warn('Iframe print failed:', err);
  }

  if (window.print) {
    window.print();
  }
}
