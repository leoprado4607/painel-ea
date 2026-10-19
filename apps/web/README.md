# Site (Next.js)

Telas em formulário: login com verificação em duas etapas → lista de processos da OM → processo em 5 etapas
(Dados, Rubricas, Valores recebidos, Valores devidos, Conferência). A conferência roda o motor de cálculo
(`packages/engine`) com a série de índices do banco.

## Publicação

No ar em **https://painel-ea.vercel.app** (Vercel, projeto `painel-ea`, região São Paulo). Para publicar uma nova versão, rode na raiz do repositório:

```bash
npx vercel@62.2.0 deploy --prod --scope leos-projects-c696e1d6
```

O `.vercelignore` impede que `exemplos/` (fichas reais), `tools/`, `supabase/`, os testes e os `.env.local` subam.
Não rode `next build` com o `npm run dev` ligado: os dois usam a pasta `.next`.

## Rodar no computador

1. Aplique o banco no seu projeto Supabase (veja `supabase/README.md`).
2. Copie `.env.example` para `.env.local` e preencha a URL e a chave **anon** do projeto
   (Painel do Supabase → Project Settings → API). Hoje o `.env.local` tem valores de exemplo.
3. Na raiz do repositório:
   ```bash
   npm install
   ```
   ```bash
   npm run dev
   ```
   e abra http://localhost:3000.

## Primeiro acesso

Ainda não há tela de cadastro de usuários. Para criar o primeiro gestor de uma OM:

1. Painel do Supabase → **Authentication → Users → Add user** (e-mail e senha).
2. **SQL Editor** (troque os valores):
   ```sql
   insert into om (nome, regiao_militar, codom) values ('Nome da OM', '11ª', '000000') returning id;
   insert into perfil (usuario_id, om_id, papel, nome)
   values ('<id do usuário criado>', '<id da OM acima>', 'gestor', 'Nome do Gestor');
   ```
3. No 1º login, o site pede para cadastrar um aplicativo autenticador (QR code). Depois disso, a cada login ele pede o código.

## Prévia sem banco (só em desenvolvimento)

`/dev/previa` mostra o formulário do processo, e `/dev/previa?tela=valores` mostra a tela de valores, ambos com dados fictícios.
Em produção essas rotas respondem 404.

## Testes

```bash
npm test -w @painel-ea/web
```
