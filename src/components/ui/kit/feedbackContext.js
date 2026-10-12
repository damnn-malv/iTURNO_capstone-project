import { createContext, useContext } from "react";

export const FeedbackContext = createContext(null);

/**
 * Settings action feedback.
 *
 *   const { notify, report, confirmAction } = useFeedback();
 *
 *   notify.success({ title, message, undo?: { label, onUndo } })   centered, closes itself (3 s, or 5 s with Undo)
 *   notify.error({ title, message, onRetry? })                     centered, stays until dismissed
 *   report(outcome)       outcome is { success: {...} } or { error: {...} }, shown with the two calls above
 *   confirmAction({ title, message, confirmLabel, busyLabel, tone, run })
 *                         asks first, locks the dialog while `run()` works, then closes it and reports run()'s outcome
 */
export const useFeedback = () => useContext(FeedbackContext);
