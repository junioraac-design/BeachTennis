// "Planilha" local para testes: guarda as mesmas abas da planilha Vendas e Pagamentos
// num arquivo JSON. Na Fase 2 trocamos por uma versão que fala com o Google Sheets,
// com exatamente os mesmos métodos (getRows / appendRow).
import fs from "node:fs";

export class LocalStore {
  constructor(file) {
    this.file = file;
    this.data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  }

  getRows(tab) {
    return this.data[tab] ?? [];
  }

  appendRow(tab, row) {
    (this.data[tab] ??= []).push(row);
    if (this.file) fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    return row;
  }
}

export function nextId(store, tab, col) {
  const ids = store.getRows(tab).map((r) => Number(r[col])).filter(Number.isFinite);
  return (ids.length ? Math.max(...ids) : 0) + 1;
}
