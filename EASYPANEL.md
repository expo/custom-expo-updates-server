# Instalação inicial no EasyPanel

Painel: https://cloud.vdigitaislab.com
Servidor OTA: https://expo.vdigitalslab.com

## Aplicação
- Projeto: servers
- Serviço: expo-updates
- Repositório: https://github.com/lidierynascimento/expo-updates-server.git
- Branch de validação: feat/easypanel-deploy
- Método de build: Dockerfile
- Dockerfile: Dockerfile
- Contexto de build: raiz do repositório (.)
- Porta interna: 3000
- Domínio HTTPS: expo.vdigitalslab.com, destino HTTP porta 3000

## Ambiente
HOSTNAME=https://expo.vdigitalslab.com
NEXT_TELEMETRY_DISABLED=1

Neste exemplo upstream, HOSTNAME é a URL pública usada nos links dos assets.
O processo escuta em 0.0.0.0 pelo argumento explícito do comando de inicialização.
Não usar yarn start: o script upstream força a chave pública de demonstração.

## Persistência
Criar volume persistente para /app/updates.
O processo usa UID/GID 1000:1000; garantir permissão de leitura e escrita nesse volume.
A imagem não inclui atualizações nem chaves de demonstração.
Não é necessário banco de dados.

## Validação inicial
Abrir a página inicial após o deploy.
GET /api/manifest sem plataforma retorna 400.
GET /api/manifest?platform=android&runtime-version=1 retorna 404 enquanto não houver atualização publicada.
Isso valida o serviço, não comprova entrega OTA ao app.

## Próxima etapa: publicação e assinatura
O app deve apontar updates.url para https://expo.vdigitalslab.com/api/manifest.
Publicar exports compatíveis com o runtime do app em /app/updates/<runtime>/<timestamp>/,
incluindo metadata.json, expoConfig.json, bundles e assets.
Nenhuma atualização do aplicativo real foi publicada por esta configuração.

Para assinatura, gerar um novo par de chaves e certificado, guardar a chave privada fora do Git,
montar o arquivo em /app/secrets/private-key.pem e definir PRIVATE_KEY_PATH com esse caminho.
Configurar o certificado correspondente no app e gerar novo build.
As chaves presentes no fork são públicas e servem apenas para demonstração.

Este fork é uma implementação demonstrativa. A imagem é uma preparação de deploy,
não uma validação de produção. Validar o build no EasyPanel e o fluxo OTA com um app de teste
antes de apontar versões usadas por passageiros.
