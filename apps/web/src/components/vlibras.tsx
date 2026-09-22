import { useEffect, useState } from "react";

/**
 * Endereço do plugin, no domínio do governo.
 *
 * O arquivo carrega um segundo pacote (o avatar 3D, alguns megabytes) do mesmo
 * domínio. Não há versão fixada publicada: `vlibras-plugin.js` é sempre o
 * mais recente, então o comportamento pode mudar sem aviso nosso.
 */
const PLUGIN = "https://vlibras.gov.br/app/vlibras-plugin.js";
const APP = "https://vlibras.gov.br/app";

const ID_DO_SCRIPT = "vlibras-plugin";

declare global {
  interface Window {
    VLibras?: { Widget: new (app: string) => unknown };
  }
}

/**
 * Tradução para Libras, pelo VLibras do governo federal.
 *
 * Libras é a segunda língua oficial do Brasil (Lei 10.436/2002), e o Decreto
 * 5.626/2005 trata o acesso em Libras como direito na educação — numa escola,
 * legenda e leitor de tela não cobrem quem tem o português escrito como
 * segunda língua. O VLibras é a implementação gratuita e oficial, mantida
 * pelo governo com a UFPB.
 *
 * DECISÃO-JOÃO: carregar um script de terceiro em toda página do app.
 * Quebra se: o plugin vem de `vlibras.gov.br` e baixa o avatar 3D de lá. Com
 *   CSP em produção — `script-src` e `connect-src` —, ele é bloqueado em
 *   silêncio e o botão some. Sem rede externa (escola com internet ruim, que é
 *   o caso de boa parte da rede pública) ele simplesmente não aparece. E o
 *   arquivo não é versionado: sempre carrega o mais recente, então uma
 *   mudança no lado deles chega aqui sem passar por nenhuma revisão nossa.
 * Fiz assim: carregamento assíncrono, tolerante a falha e sem bloquear nada.
 *   Se o script não vier, o app segue exatamente como antes — nenhum estado,
 *   nenhum erro na tela, nenhuma dependência nova no `package.json`.
 * Alternativas: hospedar o plugin no nosso domínio (o VLibras é software
 *   público, licença LGPL — some o problema de CSP e de versão, entra o de
 *   manter a cópia atualizada) · Hand Talk, que é pago acima do plano
 *   gratuito e envia o texto da página para o servidor deles, o que numa tela
 *   com nome e nota de criança é decisão de privacidade, não de acessibilidade.
 *
 * **O que ele lê.** O VLibras traduz o texto que a pessoa seleciona ou sobre o
 * qual ela clica, no navegador. Não enviamos nada para lá por conta própria —
 * mas quem aperta o botão numa tela de boletim está mandando aquele trecho
 * para o serviço. Vale estar no aviso de privacidade da escola.
 */
export function VLibras() {
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    // O plugin mexe no DOM e só existe no navegador. No servidor esta
    // renderização precisa sair vazia, ou a hidratação diverge.
    if (document.getElementById(ID_DO_SCRIPT)) return;

    const script = document.createElement("script");
    script.id = ID_DO_SCRIPT;
    script.src = PLUGIN;
    script.async = true;

    script.onload = () => {
      try {
        if (window.VLibras) new window.VLibras.Widget(APP);
        setCarregado(true);
      } catch {
        // Plugin carregou e falhou ao iniciar: o acesso ao app não depende
        // disso, então engolimos em vez de derrubar a árvore do React.
      }
    };

    // Sem rede, com CSP bloqueando ou com o domínio fora do ar: fica como
    // estava. Nenhum aviso na tela — um alerta de "tradutor indisponível" em
    // toda página seria ruído para quem não usa o recurso.
    script.onerror = () => setCarregado(false);

    document.body.appendChild(script);
  }, []);

  /*
   * A marcação é a que o plugin procura, e os nomes dos atributos são dele:
   * `vw`, `vw-access-button`, `vw-plugin-wrapper`. Ficam fora da convenção do
   * projeto de propósito — renomear faz o widget não achar o próprio ponto de
   * montagem. Vão por espalhamento porque não existem no JSX tipado, e um
   * `declare module` global para três atributos de terceiro poluiria o tipo
   * de todo elemento do app.
   */
  const marcacao = {
    raiz: { vw: "true" },
    botao: { "vw-access-button": "true" },
    wrapper: { "vw-plugin-wrapper": "true" },
  };

  return (
    // `hidden` até o script confirmar que subiu: botão morto no canto da tela
    // é pior que botão nenhum, porque a pessoa clica e conclui que o recurso
    // está quebrado.
    <div hidden={!carregado}>
      <div {...marcacao.raiz} className="enabled">
        <div {...marcacao.botao} className="active" />
        <div {...marcacao.wrapper}>
          <div className="vw-plugin-top-wrapper" />
        </div>
      </div>
    </div>
  );
}
