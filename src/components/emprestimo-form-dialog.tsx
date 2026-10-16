"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { quantidadeEmprestada } from "@/lib/mapeamento";
import {
  type Emprestimo,
  type Item,
  type NovoEmprestimo,
  podeEmprestar,
  rotulo,
} from "@/lib/types";
import { hojeLocal } from "@/lib/utils";

const PEDIDO_VAZIO: Omit<NovoEmprestimo, "codigo"> = {
  quantidade: 1,
  pessoa: "",
  contato: "",
  devolverAte: "",
  observacoes: "",
};

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Item ja escolhido (vindo da linha da tabela), ou null para digitar o codigo. */
  item: Item | null;
  itens: Item[];
  emprestimos: Emprestimo[];
  aoSalvar: (dados: NovoEmprestimo) => Promise<void>;
}

export function EmprestimoFormDialog({
  aberto,
  aoFechar,
  item: itemInicial,
  itens,
  emprestimos,
  aoSalvar,
}: Props) {
  const [codigo, definirCodigo] = useState("");
  const [form, definirForm] = useState(PEDIDO_VAZIO);
  const [salvando, definirSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    definirCodigo(itemInicial?.codigo ?? "");
    definirForm(PEDIDO_VAZIO);
  }, [aberto, itemInicial]);

  // O codigo da etiqueta e o jeito mais rapido de achar o item no balcao.
  const codigoCompleto = codigo.trim() ? codigo.trim().padStart(4, "0") : "";
  const item = useMemo(
    () => itens.find((i) => i.codigo === codigoCompleto) ?? null,
    [itens, codigoCompleto],
  );
  const fora = item ? quantidadeEmprestada(item.codigo, emprestimos) : 0;
  const disponivel = item ? item.quantidade - fora : 0;

  let problema = "";
  if (codigoCompleto && !item) problema = `Nenhum item com o código ${codigoCompleto}.`;
  else if (item && !podeEmprestar(item))
    problema =
      item.estado === "Descartado"
        ? "Este item foi descartado."
        : "Consumível é retirado, não emprestado.";
  else if (item && disponivel <= 0) problema = "Todas as unidades já estão emprestadas.";
  else if (item && form.quantidade > disponivel)
    problema = `Só ${disponivel} ${item.unidade || "un"} disponível.`;

  const podeSalvar =
    !!item && !problema && form.pessoa.trim() !== "" && form.quantidade > 0;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!item || !podeSalvar) return;
    definirSalvando(true);
    try {
      await aoSalvar({ ...form, codigo: item.codigo });
      aoFechar();
    } catch {
      // O toast de erro ja foi mostrado; o dialogo fica aberto.
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emprestar</DialogTitle>
          <DialogDescription>
            Registre quem levou. O item volta a ficar disponível quando você
            marcar a devolução.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="grid gap-4">
          {itemInicial ? null : (
            <div className="grid gap-2">
              <Label htmlFor="emp-codigo">Código da etiqueta *</Label>
              <Input
                id="emp-codigo"
                inputMode="numeric"
                value={codigo}
                onChange={(e) => definirCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="0042"
                className="w-28 font-display text-lg font-extrabold tracking-[0.08em]"
                autoFocus
              />
            </div>
          )}

          <div className="rounded-md bg-secondary px-3 py-2 text-sm">
            {item ? (
              <div className="flex items-center gap-3">
                <span className="fita">{item.codigo}</span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      rotulo(item.categoria),
                      item.local,
                      podeEmprestar(item)
                        ? `${disponivel} de ${item.quantidade} ${item.unidade || "un"} disponível`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">
                Digite o código colado no objeto.
              </span>
            )}
            {problema && <p className="mt-1 text-destructive">{problema}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="grid gap-2">
              <Label htmlFor="emp-pessoa">Quem está levando *</Label>
              <Input
                id="emp-pessoa"
                value={form.pessoa}
                onChange={(e) => definirForm({ ...form, pessoa: e.target.value })}
                placeholder="Nome"
                required
                autoFocus={!!itemInicial}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-qtd">Quantidade</Label>
              <Input
                id="emp-qtd"
                type="number"
                min={1}
                max={Math.max(disponivel, 1)}
                step="any"
                value={form.quantidade}
                onChange={(e) => definirForm({ ...form, quantidade: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="emp-contato">Contato</Label>
              <Input
                id="emp-contato"
                value={form.contato}
                onChange={(e) => definirForm({ ...form, contato: e.target.value })}
                placeholder="Telefone, e-mail ou RA"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-prazo">Devolver até</Label>
              <Input
                id="emp-prazo"
                type="date"
                min={hojeLocal()}
                value={form.devolverAte}
                onChange={(e) => definirForm({ ...form, devolverAte: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="emp-obs">Observações</Label>
            <Textarea
              id="emp-obs"
              value={form.observacoes}
              onChange={(e) => definirForm({ ...form, observacoes: e.target.value })}
              placeholder="Para que projeto, estado em que saiu..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !podeSalvar}>
              {salvando ? "Registrando..." : "Registrar empréstimo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
