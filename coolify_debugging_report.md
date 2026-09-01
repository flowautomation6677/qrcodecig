# Relatório de Debug e Deploy no Coolify (Next.js)

## 📌 Resumo do Problema
A aplicação Next.js foi conteinerizada com sucesso, inicia corretamente e escuta na porta `3000` (conforme logs internos do container). No entanto, o proxy reverso do Coolify (Traefik/Caddy) está falhando em rotear o tráfego externo para dentro do container, resultando em erros de roteamento (primeiro `404 page not found` e depois `no available server`).

---

## ⏱️ Histórico de Ações e Diagnósticos

### Fase 1: Erro Inicial (404 Page Not Found)
* **Sintoma:** O navegador exibia uma tela branca com `404 page not found`. Este é um erro gerado pelo proxy (Traefik) quando ele não encontra nenhuma regra de roteamento válida para o domínio requisitado.
* **Diagnóstico:** O Next.js com `output: 'standalone'` e o comando padrão de start podiam estar conflitando, fazendo com que o container não se comunicasse na rede correta.
* **Ações Tomadas:**
  - Removemos o `output: 'standalone'` do arquivo `next.config.mjs`.
  - Editamos o `package.json` para garantir o binding no host público: `"start": "next start -H 0.0.0.0 -p 3000"`.
  - Criamos um `Dockerfile` de produção padrão.
* **Resultado:** O container subiu com sucesso! Os logs mostraram `Ready in 494ms` na rede `0.0.0.0:3000`. Porém, o erro no navegador mudou.

### Fase 2: Erro Secundário (No Available Server)
* **Sintoma:** O navegador passou a exibir `no available server`. Isso indica que o roteador sabe qual domínio está sendo acessado, mas **não consegue encontrar um servidor ativo** na porta mapeada (ou a porta está mapeada de forma incorreta nas regras do proxy).
* **Diagnóstico:**
  1. O Coolify poderia estar assumindo a porta 80 ao invés da 3000.
  2. Poderia haver regras residuais de "Site Estático" injetadas no proxy.
* **Ações Tomadas:**
  - Validamos que o campo **Ports Exposes** estava configurado para `3000`.
  - Verificamos as métricas avançadas e notamos que a configuração "Is it a static site?" estava injetando regras de proxy do Caddy (`caddy_0.try_files={path} /index.html /index.php`), impedindo o Node.js de processar as requisições dinâmicas.

### Fase 3: Cache do Coolify e Tentativas de Limpeza
* **Sintoma:** As regras de site estático continuavam persistindo na configuração de rede mesmo após desativar a chave correspondente.
* **Diagnóstico:** O banco de dados interno do Coolify estava fazendo cache ("prendendo") as regras (Labels) de rede antigas no serviço, um bug conhecido na versão 4 do painel.
* **Ações Tomadas:**
  - Tentativa de **Redeploy** manual para forçar a recriação do container e a limpeza das labels.
  - Como a limpeza não funcionou, orientamos a **Exclusão completa** do serviço no Coolify e a **recriação do zero** puxando novamente do GitHub, garantindo um ambiente virgem.
* **Resultado:** Após recriar do zero (sem as regras residuais), o erro `no available server` permaneceu de forma surpreendente, comprovando que a rede interna do Docker do Coolify via Buildpack "Dockerfile" está com um gargalo de comunicação com o Traefik neste ambiente específico.

---

## 🚀 Próximos Passos (Ação Atual)

Uma vez que o método de Dockerfile personalizado esbarra em instabilidades de rede do próprio Coolify para este servidor em específico, a estratégia definitiva foi pivotar para o construtor nativo da plataforma:

### **Migração para Nixpacks**
Em vez de construir manualmente a imagem Docker e forçar a exposição de porta, delegamos isso ao **Nixpacks** (Build Pack padrão do Coolify):
1. O painel passa a reconhecer que é um app Next.js automaticamente.
2. Não depende de Dockerfile local.
3. As variáveis e regras do Traefik são auto-ajustadas (Injetadas) pelo Coolify durante o build.

**Status atual:** Aguardando a execução do build via **Nixpacks** (`npm install` -> `npm run build` -> `npm start`) para validação final.
