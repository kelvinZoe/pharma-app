/**
 * Safe, injection-free formula expression evaluator for dynamic medical template worksheets.
 * Supports standard arithmetic operations (+, -, *, /), parentheses, comparison operators (<, >, <=, >=, ==, ===, !=, !==),
 * conditional ternary operators (? :), quotes, and logical operators (&&, ||, !).
 * Strictly sanitizes inputs to prevent code injection.
 */
export function evaluateFormula(formula: string, context: Record<string, any>): any {
  if (!formula || typeof formula !== 'string') return '';

  try {
    let sanitized = formula;

    // Replace variable keys with active values from context.
    // Sort keys by length descending to avoid substring collision (e.g. "result" replacing a substring of "result_status")
    const keys = Object.keys(context).sort((a, b) => b.length - a.length);
    keys.forEach(key => {
      const val = context[key];
      // Format strings inside single quotes, numbers raw, and defaults to 0 if undefined/null
      const replacement = typeof val === 'string'
        ? `'${val.replace(/'/g, "\\'")}'`
        : (val !== undefined && val !== null && val !== '' ? val.toString() : '0');
      sanitized = sanitized.replace(new RegExp(`\\b${key}\\b`, 'g'), replacement);
    });

    // Strip out all spaces for parsing safety check
    const rawCheck = sanitized.replace(/\s+/g, '');

    // Safety validation regex: allow only numbers, basic arithmetic symbols, parentheses, ternary operators,
    // single/double quotes, comparison signs, logical gates, and the word "true" or "false".
    // Disallow absolute letters, dots, brackets, braces, functions, window/document/eval keywords.
    const safeRegex = /^[0-9.+\-*/()?:"'<>=!&|]+$/;

    // We allow standard boolean keywords since they are safe, but check raw content.
    const isSafe = safeRegex.test(rawCheck.replace(/true|false/g, ''));
    if (!isSafe) {
      console.warn('Formula execution blocked: expression contains potentially unsafe syntax.', sanitized);
      return '';
    }

    // Standard Math evaluator calculation inside an isolated strict execution context
    const evaluator = new Function(`"use strict"; return (${sanitized});`);
    const result = evaluator();
    
    // Format numeric outcomes cleanly
    if (typeof result === 'number') {
      if (isNaN(result) || !isFinite(result)) return 0;
      // Round to 3 decimal places max if decimal
      return Number(result.toFixed(3));
    }
    return result ?? '';
  } catch (err) {
    console.error('Error evaluating formula:', formula, err);
    return '';
  }
}
