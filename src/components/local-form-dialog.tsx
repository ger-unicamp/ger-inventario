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
import { nomeDoLocal } from "@/lib/mapeamento";
import type { Local, NovoLocal } from "@/lib/types";
import { normalizar } from "@/lib/utils";

const LOCAL_VAZIO: NovoLocal = { movel: "", zona: "", observacoes: "" };

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Local sendo editado, ou null para cadastro novo. */
  local: Local | null;
  /** Todos os locais, para sugerir moveis e avisar de duplicado. */
  locais: Local[];
  /** Quantos itens estao no local editado (inclui descartados). */
  itensNoLocal?: number;
  /** Movel ja preenchido ao cadastrar uma zona nova a partir de um movel. */
  movelInicial?: string;
  aoSalvar: (dados: NovoLocal, nomeAtual: string | null) => Promise<void>;
}

export function LocalFormDialog({
  aberto,
  aoFechar,
  local,
  locais,
  itensNoLocal = 0,
  movelInicial = "",
  aoSalvar,
}: Props) {
  const [form, definirForm] = useState<NovoLocal>(LOCAL_VAZIO);
  const [salvando, definirSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    definirForm(
      local
        ? { movel: local.movel, zona: local.zona, observacoes: local.observacoes }
        : { ...LOCAL_VAZIO, movel: movelInicial },
    );
  }, [aberto, local, movelInicial]);

  const moveis = useMemo(
    () => [...new Set(locais.map((l) => l.movel))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [locais],
  );

  const nome = nomeDoLocal(form.movel, form.zona);
  const repetido = locais.find(
    (l) => l.nome !== local?.nome && nome && normalizar(l.nome) === normalizar(nome),
  );
  const renomeando = local !== null && nome !== "" && nome !== local.nome;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form.movel.trim() || repetido) return;
    definirSalvando(true);
    try {
      await aoSalvar(form, local?.nome ?? null);
      aoFechar();
    } catch {
      // O toast de erro ja foi mostrado por quem salvou; o dialogo fica aberto.
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{local ? "Editar local" : "Novo local"}</DialogTitle>
          <DialogDescription>
            O móvel é o armário, bancada ou estante. A zona é opcional: a
            prateleira, gaveta ou painel dentro dele.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="local-movel">Móvel *</Label>
              <Input
                id="local-movel"
                list="sugestoes-movel"
                value={form.movel}
                onChange={(e) => definirForm({ ...form, movel: e.target.value })}
                placeholder="Ex.: Armario B"
                required
                autoFocus
              />
              <datalist id="sugestoes-movel">
                {moveis.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="local-zona">Zona</Label>
              <Input
                id="local-zona"
                value={form.zona}
                onChange={(e) => definirForm({ ...form, zona: e.target.value })}
                placeholder="Ex.: Gaveta 3"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="local-obs">Observações</Label>
            <Textarea
              id="local-obs"
              value={form.observacoes}
              onChange={(e) => definirForm({ ...form, observacoes: e.target.value })}
              placeholder="Onde fica, quem tem a chave..."
              rows={2}
            />
          </div>

          <div className="rounded-md bg-secondary px-3 py-2 text-sm">
            {nome ? (
              <>
                Nos itens vai aparecer como{" "}
                <strong className="font-semibold">{nome}</strong>
              </>
            ) : (
              <span className="text-muted-foreground">Preencha o móvel.</span>
            )}
            {repetido && (
              <p className="mt-1 text-destructive">
                Já existe o local “{repetido.nome}”.
              </p>
            )}
            {renomeando && itensNoLocal > 0 && (
              <p className="mt-1 text-muted-foreground">
                Isso atualiza {itensNoLocal}{" "}
                {itensNoLocal === 1 ? "item" : "itens"} que estão em “{local.nome}”.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !form.movel.trim() || !!repetido}>
              {salvando ? "Salvando..." : local ? "Salvar local" : "Cadastrar local"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
