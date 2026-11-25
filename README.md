# Pesquisa de satisfação · Affeto Gastronomia Funcional

A página inicial apresenta seis perguntas sobre a experiência na Affeto. A sexta é opcional. O formulário é anônimo e o painel em `/admin/` exige uma conta autorizada. O site é estático e usa o Supabase para gravar respostas e autenticar a administração.

## 1. Crie um projeto no Supabase

1. Acesse [Supabase](https://supabase.com/dashboard), entre e clique em **New project**.
2. Escolha sua organização e dê um nome como **Affeto Pesquisa**. Use um projeto dedicado à pesquisa. Confira os limites e condições do plano gratuito antes de criar.
3. Escolha uma região próxima, guarde a senha do banco em um gerenciador de senhas e aguarde o projeto ficar pronto. Essa senha é diferente da senha usada para entrar no painel.

## 2. Prepare o banco

1. No projeto novo, abra **SQL Editor** e clique em **New query**.
2. Abra o arquivo [supabase/setup.sql](supabase/setup.sql) deste repositório. Copie seu conteúdo inteiro para o editor e clique em **Run** uma vez.
3. Execute também [supabase/survey-status.sql](supabase/survey-status.sql) em uma nova consulta para habilitar o controle de disponibilidade.
4. Em **Table Editor**, procure a tabela `responses_affeto`. Ela deve estar vazia.

O SQL limita os valores aceitos, exige de uma a duas opções nas perguntas 3 e 5, e configura as permissões. O público pode inserir. Uma conta autenticada precisa da marca administrativa para consultar. A data é preenchida pelo banco.

## 3. Configure o login e crie a conta administradora

1. No Supabase, abra **Authentication** e procure **Sign In / Providers**. Mantenha o provedor **Email** ativo e desative **Allow new users to sign up** para impedir cadastro público.
2. Em **Authentication → Users**, use **Add user → Create new user**. Informe o e-mail administrativo, use uma senha forte e marque **Auto confirm user** se a opção estiver disponível. Caso contrário, confirme o endereço pelo e-mail.
3. Abra a ficha desse usuário e copie seu **User UID**. Ele é um identificador com letras, números e traços.
4. Em **SQL Editor → New query**, cole o trecho abaixo, substitua `COLE-O-USER-UID-AQUI` pelo identificador e clique em **Run**. Confira se a consulta devolve o usuário correto com `autorizado` igual a `true`.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"affeto_admin": true}'::jsonb
where id = 'COLE-O-USER-UID-AQUI'::uuid
returning email, raw_app_meta_data -> 'affeto_admin' as autorizado;
```

Se a conta já estava conectada, saia e entre novamente para receber a autorização atualizada. Para remover o acesso, no mesmo comando use `{"affeto_admin": false}`. Tokens já emitidos podem continuar válidos até expirar.

## 4. Conecte o site

1. No painel do Supabase, abra **Connect** ou **Project Settings → API Keys**. Copie a **Project URL** e a chave **Publishable** (começa com `sb_publishable_`). A chave pública legada `anon` também é aceita.
2. Na pasta `js`, faça uma cópia de `config.example.js` chamada `config.js`.
3. Abra `config.js` em um editor de texto. Cole a URL entre as aspas da linha `SUPABASE_URL` e a chave pública entre as aspas da linha `SUPABASE_ANON_KEY`.
4. Quando tiver a logo oficial, coloque o arquivo original em uma pasta `assets` na raiz do repositório. Preencha `LOGO_URL` com o caminho, por exemplo `./assets/logo-affeto.png`. O mesmo arquivo aparecerá no cabeçalho das duas páginas.

A URL e a chave pública ficam visíveis no navegador por definição. A senha do banco, a senha da administração e as chaves **secret** e **service_role** devem ficar fora do código e do GitHub.

## 5. Teste no computador antes de publicar

1. Abra a pasta do projeto em um terminal. Com Python 3 instalado, execute `python3 -m http.server 8000` (no Windows também pode usar `py -m http.server 8000`). Deixe o terminal aberto durante o teste.
2. No navegador, acesse `http://localhost:8000/`. Confirme os enunciados das seis perguntas. Tente avançar sem preencher cada uma das cinco primeiras, voltar e avançar de novo, marcar três itens nas perguntas 3 e 5 e digitar mais de 300 caracteres na pergunta 6.
3. Envie uma resposta com a última pergunta em branco. Tente clicar duas vezes rapidamente no botão final e confirme a tela de agradecimento.
4. No Supabase, abra **Table Editor → responses_affeto**. Confira que a resposta aparece uma única vez, com as opções escolhidas e a data. Envie uma segunda resposta com sugestão se quiser conferir a lista de comentários.
5. Abra `http://localhost:8000/admin/`. Confirme que a página começa no login. Teste a senha errada, entre com a conta administradora e confira o total, os gráficos, a data da sugestão e o botão **Exportar CSV**. Abra o CSV e confira os registros. Os cruzamentos aparecem quando pelo menos um grupo de frequência tem cinco respostas.
6. Teste a largura de celular usando o modo responsivo das ferramentas de desenvolvedor do navegador. Em uma janela anônima, abra novamente `/admin/` e confirme que os resultados exigem login. Para conferir uma conta comum, crie outro usuário de teste no painel do Supabase e deixe o campo `affeto_admin` ausente. Essa conta deve receber a mensagem de acesso negado.

Para verificar as permissões de visitante sem tocar nos dados, use o **SQL Editor**. Execute este bloco inteiro e confira que as três colunas retornam `false`:

```sql
select
  has_table_privilege('anon', 'public.responses_affeto', 'SELECT') as pode_ler,
  has_table_privilege('anon', 'public.responses_affeto', 'DELETE') as pode_excluir,
  has_any_column_privilege('anon', 'public.responses_affeto', 'UPDATE') as pode_alterar;
```

Se preferir verificar também a API, substitua `URL-DO-PROJETO` e `CHAVE-PUBLICA` e execute no console do navegador de uma página local. Use a chave **Publishable**. Cada operação deve retornar um erro HTTP, geralmente 401 ou 403. Os comandos de alteração e exclusão apontam para um identificador de teste que você deve confirmar que não existe no **Table Editor**.

```js
const endpoint = 'URL-DO-PROJETO/rest/v1/responses_affeto';
const apikey = 'CHAVE-PUBLICA';
const semRegistro = '?id=eq.00000000-0000-0000-0000-000000000000';
for (const method of ['GET', 'PATCH', 'DELETE']) {
  const response = await fetch(endpoint + semRegistro, {
    method,
    headers: { apikey, 'Content-Type': 'application/json' },
    ...(method === 'PATCH' && { body: JSON.stringify({ suggestion: 'teste' }) }),
  });
  console.log(method, response.status);
}
```

## 6. Coloque os arquivos no GitHub e ative o Pages

1. No GitHub, abra o repositório **Affeto-Gastronomia** e envie os arquivos mantendo as pastas originais. Inclua o `js/config.js` preenchido somente com os dados públicos. Se usar **Add file → Upload files**, confira a estrutura depois do envio e inclua o arquivo oculto `.nojekyll` se o seletor permitir. Se já estiver usando Git, revise os arquivos, faça o commit e envie sua branch. Mescle em `main` pelo fluxo do repositório.
2. Abra **Settings → Pages**. Em **Source**, escolha **Deploy from a branch**. Selecione a branch `main`, pasta `/ (root)`, e clique em **Save**. O Pages depende da visibilidade do repositório e do plano do GitHub. Verifique a disponibilidade em **Settings → Pages** antes de mudar a visibilidade.
3. Aguarde o GitHub mostrar o endereço publicado. Abra esse endereço para acessar a pesquisa e acrescente `admin/` ao final para abrir o painel. A URL do painel pode ser acessada por qualquer pessoa, mas os resultados são restritos à conta autorizada.
4. Repita um envio de teste no endereço publicado antes de compartilhar o link. Recarregue a página para testar um novo envio e entre novamente no painel para atualizar os resultados. Após a validação, se precisar apagar respostas de teste, exclua apenas os registros identificados no **Table Editor** do projeto dedicado.

## Uso e manutenção

O Excel e o CSV incluem as respostas do período selecionado. Os campos de múltipla escolha ficam na mesma célula, separados por ` | `, e as datas usam o horário de Brasília. Os períodos de 7 e 30 dias incluem o dia atual. No período personalizado, as duas datas são inclusivas. Trate os comentários e arquivos exportados como dados de acesso restrito. A sessão do painel é mantida na memória da página e termina ao sair, recarregar ou atingir o tempo de expiração.

O questionário não pede dados pessoais. A inserção é pública, como exige uma pesquisa anônima. O identificador evita duplicação por cliques e retentativas do mesmo envio. Se a pesquisa passar a receber spam, avalie proteção contra automação no servidor antes de ampliar a divulgação.


### Atualização de uma instalação existente

No projeto atual da Affeto, abra **SQL Editor → New query**, cole todo o conteúdo de [supabase/survey-status.sql](supabase/survey-status.sql) e execute uma vez antes de publicar esta versão. Em uma instalação existente, execute apenas essa migração.

A migração cria uma tabela com um único registro, inicialmente ativo. Visitantes e contas autenticadas podem consultar a disponibilidade. Somente administradores com `affeto_admin = true` podem mudar o status pelo painel. Um gatilho na tabela de respostas recusa novas inserções enquanto a pesquisa está pausada, inclusive de formulários abertos antes da pausa. As respostas existentes e suas políticas de acesso são preservadas.

Depois de publicar a versão autorizada, entre no painel, pause a pesquisa e abra seu link público em outra aba. Confirme a mensagem de pausa, reative a pesquisa e recarregue a aba pública para confirmar a reabertura.
