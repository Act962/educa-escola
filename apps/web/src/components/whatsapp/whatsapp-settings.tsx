import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@educa-escola/ui/components/tabs";
import { ErrorState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";

import { useTRPC } from "@/utils/trpc";

import { ContaDoWhatsApp } from "./conta";
import { EnviosDoWhatsApp } from "./envios";
import { ModelosDoWhatsApp } from "./modelos";

/**
 * A aba de WhatsApp, dentro de Configurações.
 *
 * Uma consulta só alimenta as três seções — número, modelos e envios —, porque
 * elas aparecem juntas na mesma tela: quatro queries seriam quatro estados de
 * carregamento numa tela só.
 *
 * O trilho interno é `Tabs` e não acordeão: as três seções são etapas de um
 * mesmo caminho (configurar → escrever → enviar), e quem volta à tela quase
 * sempre vai a uma delas, não às três.
 */
export function WhatsAppSettings() {
  const trpc = useTRPC();
  const visao = useQuery({ ...trpc.whatsapp.visao.queryOptions(), retry: false });

  if (visao.isLoading) {
    return (
      <Card>
        <ListSkeleton rows={5} />
      </Card>
    );
  }

  if (visao.isError) {
    return (
      <Card>
        {/* 403 aqui é resposta esperada: professor e aluno têm `whatsapp: []`.
            Tratar como falha diria "tente de novo" a quem nunca vai conseguir. */}
        {visao.error.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Esta área é da direção"
            description="O número oficial da escola fala em nome dela. Quem o configura é quem responde pela instituição."
          />
        ) : (
          <ErrorState
            title="Não foi possível carregar a integração"
            description="Atualize a página em instantes."
          />
        )}
      </Card>
    );
  }

  if (!visao.data) return null;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <CardEyebrow>Integração</CardEyebrow>
        <h2 className="font-extrabold text-xl tracking-[-0.4px]">WhatsApp</h2>
        <p className="text-corpo text-muted-foreground">
          O número oficial da escola, os modelos de mensagem e o que já saiu.
        </p>
      </div>

      {visao.data.simulacao ? (
        <Alert variant="info">
          <FlaskConical />
          <AlertTitle>Em simulação: nenhuma mensagem sai daqui</AlertTitle>
          <AlertDescription>
            O fluxo funciona inteiro e o histórico registra, mas nada chega a ninguém. É assim que
            se apresenta a integração sem mandar WhatsApp para família nenhuma.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="numero">
        <TabsList>
          <TabsTrigger value="numero">Número</TabsTrigger>
          <TabsTrigger value="modelos">
            Modelos{visao.data.modelos.length > 0 ? ` (${visao.data.modelos.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="envios">Envios</TabsTrigger>
        </TabsList>

        <TabsContent value="numero">
          <ContaDoWhatsApp visao={visao.data} />
        </TabsContent>

        <TabsContent value="modelos">
          <ModelosDoWhatsApp visao={visao.data} />
        </TabsContent>

        <TabsContent value="envios">
          <EnviosDoWhatsApp visao={visao.data} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
