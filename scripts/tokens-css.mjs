// Genera apps/ui/src/styles/tokens.css a partir de design/tokens.json (D-027).
// Uso: pnpm tokens
import { readFileSync, writeFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'));
const value = (v) => {
  const raw = typeof v === 'string' ? v : v.light;
  const alias = /^\{(.+)\}$/.exec(raw);
  return alias ? `var(--${alias[1]})` : raw;
};

const lines = ['/* Gonzalvo — generado desde design/tokens.json con `pnpm tokens`. No editar a mano. */', ':root {'];
for (const t of tokens.color.tokens) lines.push(`  --${t.name}: ${value(t.value)};`);
for (const t of tokens.shadow?.tokens ?? []) lines.push(`  --${t.name}: ${value(t.value)};`);
for (const t of [...tokens.spacing.tokens, ...tokens.radius.tokens]) lines.push(`  --${t.name}: ${t.value};`);
for (const [key, stack] of Object.entries(tokens.type.families)) lines.push(`  --font-${key}: ${stack};`);
lines.push('}');
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    const ls = s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : '';
    lines.push(`.${s.name} { font-family: var(--font-${s.family ?? group.family}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${ls} }`);
  }
}
writeFileSync(new URL('../apps/ui/src/styles/tokens.css', import.meta.url), `${lines.join('\n')}\n`);
console.log('tokens.css generado');
