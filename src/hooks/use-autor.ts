"use client";

import { useEffect, useState } from "react";

const CHAVE = "ger-inventario:autor";

/**
 * Quem esta mexendo no inventario agora.
 *
 * O app roda sem login (so localhost no PC do GER), mas cada alteracao grava
 * um autor na planilha. Isso vale mais no dia do mutirao, quando varias
 * pessoas passam pela mesma maquina.
 */
export function useAutor() {
  const [autor, definirAutor] = useState<string>("");
  const [carregado, definirCarregado] = useState(false);

  useEffect(() => {
    try {
      definirAutor(window.localStorage.getItem(CHAVE) ?? "");
    } catch {
      // Navegador sem storage: segue sem lembrar o nome.
    }
    definirCarregado(true);
  }, []);

  function salvarAutor(novo: string) {
    const limpo = novo.trim();
    definirAutor(limpo);
    try {
      if (limpo) window.localStorage.setItem(CHAVE, limpo);
      else window.localStorage.removeItem(CHAVE);
    } catch {
      // Ignora: o nome so nao sobrevive ao reload.
    }
  }

  return { autor, salvarAutor, carregado };
}
