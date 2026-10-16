"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { LocalFormDialog } from "@/components/local-form-dialog";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { agruparPorMovel } from "@/lib/locais";
import {
  CATEGORIAS,
  ESTADOS,
  ITEM_VAZIO,
  type Item,
  type Local,
  type NovoItem,
  type NovoLocal,
  PROJETOS,
  rotulo,
} from "@/lib/types";

/** Radix Select nao aceita "" como valor de opcao. */
const SEM_LOCAL = "__sem_local__";

const NIVEIS_SELECIONAVEIS = [
  { valor: "-", rotulo: "Não se aplica" },
  { valor: "Sobrando", rotulo: "Sobrando" },
  { valor: "Pouco", rotulo: "Pouco" },
  { valor: "Acabou", rotulo: "Acabou" },
];

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Item sendo editado, ou null para cadastro novo. */
  item: Item | null;
  /** Locais cadastrados: o item so pode ir para um deles. */
  locais: Local[];
  aoSalvar: (dados: NovoItem, codigo: string | null) => Promise<void>;
  /** Cadastra um local sem sair do formulario. Devolve o local criado. */
  aoCriarLocal: (dados: NovoLocal) => Promise<Local>;
}

export function ItemFormDialog({
  aberto,
  aoFechar,
  item,
  locais,
  aoSalvar,
  aoCriarLocal,
}: Props) {
  const [form, definirForm] = useState<NovoItem>(ITEM_VAZIO);
  const [salvando, definirSalvando] = useState(false);
  const [criandoLocal, definirCriandoLocal] = useState(false);

  const grupos = useMemo(() => agruparPorMovel(locais), [locais]);
  // Item antigo cujo local ainda nao foi cadastrado: mostra a opcao para nao
  // apagar o dado so por abrir e salvar o formulario.
  const localForaDaTabela =
    form.local !== "" && !locais.some((l) => l.nome === form.local);

  useEffect(() => {
    if (!aberto) return;
    if (item) {
      const { codigo: _c, atualizadoEm: _e, atualizadoPor: _p, ...resto } = item;
      definirForm(resto);
    } else {
      definirForm(ITEM_VAZIO);
    }
  }, [aberto, item]);

  function campo<C extends keyof NovoItem>(chave: C, valor: NovoItem[C]) {
    definirForm((anterior) => ({ ...anterior, [chave]: valor }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form.nome.trim()) return;
    definirSalvando(true);
    try {
      await aoSalvar(form, item?.codigo ?? null);
      aoFechar();
    } finally {
      definirSalvando(false);
    }
  }

  const ehConsumivel = form.categoria === "Consumivel";

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? (
              <span className="flex items-center gap-2">
                Editar item
                <span className="fita">{item.codigo}</span>
              </span>
            ) : (
              "Novo item"
            )}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "O código não muda: ele está colado no objeto. Mude local e projeto à vontade."
              : "O código de 4 dígitos é gerado ao salvar. Anote-o na etiqueta."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              placeholder="Ex.: Multímetro digital Minipa ET-1002"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => campo("categoria", v)}
              >
                <SelectTrigger id="categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {rotulo(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="projeto">Projeto</Label>
              <Select
                value={form.projeto}
                onValueChange={(v) => campo("projeto", v)}
              >
                <SelectTrigger id="projeto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJETOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {rotulo(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="local">Local</Label>
              <button
                type="button"
                onClick={() => definirCriandoLocal(true)}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3 w-3" /> Cadastrar local
              </button>
            </div>
            <Select
              value={form.local || SEM_LOCAL}
              onValueChange={(v) => campo("local", v === SEM_LOCAL ? "" : v)}
            >
              <SelectTrigger id="local">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_LOCAL}>Sem local</SelectItem>
                {localForaDaTabela && (
                  <SelectItem value={form.local}>
                    {form.local} (fora da tabela)
                  </SelectItem>
                )}
                {grupos.map((grupo) => (
                  <SelectGroup key={grupo.movel}>
                    <SelectSeparator />
                    <SelectLabel>{grupo.movel}</SelectLabel>
                    {grupo.inteiro && (
                      <SelectItem value={grupo.inteiro.nome}>
                        {grupo.movel} (inteiro)
                      </SelectItem>
                    )}
                    {grupo.zonas.map((l) => (
                      <SelectItem key={l.nome} value={l.nome}>
                        {l.zona}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {locais.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum local cadastrado ainda. Use “Cadastrar local”.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                step="any"
                min="0"
                value={form.quantidade}
                onChange={(e) => campo("quantidade", Number(e.target.value))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Input
                id="unidade"
                value={form.unidade}
                onChange={(e) => campo("unidade", e.target.value)}
                placeholder="un, m, kg, rolo"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => campo("estado", v as NovoItem["estado"])}
              >
                <SelectTrigger id="estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {rotulo(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nivel">
                Nível {ehConsumivel ? "" : "(consumíveis)"}
              </Label>
              <Select
                value={form.nivel || "-"}
                onValueChange={(v) =>
                  campo("nivel", (v === "-" ? "" : v) as NovoItem["nivel"])
                }
              >
                <SelectTrigger id="nivel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVEIS_SELECIONAVEIS.map((n) => (
                    <SelectItem key={n.valor} value={n.valor}>
                      {n.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ehConsumivel && (
                <p className="text-xs text-muted-foreground">
                  Para consumível, prefira o nível à contagem exata: contar
                  parafuso trava o mutirão.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="patrimonio">Plaqueta de patrimônio</Label>
              <Input
                id="patrimonio"
                value={form.patrimonio}
                onChange={(e) => campo("patrimonio", e.target.value)}
                placeholder="Número da plaqueta da Unicamp, se houver"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={form.observacoes}
              onChange={(e) => campo("observacoes", e.target.value)}
              placeholder="Defeito conhecido, pertence a alguém, precisa de calibração..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !form.nome.trim()}>
              {salvando ? "Salvando..." : item ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <LocalFormDialog
        aberto={criandoLocal}
        aoFechar={() => definirCriandoLocal(false)}
        local={null}
        locais={locais}
        aoSalvar={async (dados) => {
          const novo = await aoCriarLocal(dados);
          campo("local", novo.nome);
        }}
      />
    </Dialog>
  );
}
