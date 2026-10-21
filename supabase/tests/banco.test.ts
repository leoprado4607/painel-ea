/**
 * Testa as migrações num PostgreSQL local (PGlite), com um "auth" mínimo igual ao do Supabase:
 * auth.uid() lê request.jwt.claim.sub e as consultas rodam como o papel "authenticated".
 * A migração de agendamento (pg_cron/pg_net) só existe no Supabase; aqui roda apenas a view dela.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { calcular, type EntradaCalculo, type IndiceMensal } from "../../packages/engine/src";

const MIG = join(__dirname, "..", "migrations");
const GOLDEN = join(__dirname, "..", "..", "packages", "engine", "test", "golden");
const db = new PGlite();

const U = {
  operadorA: "00000000-0000-0000-0000-00000000000a",
  operadorB: "00000000-0000-0000-0000-00000000000b",
  admin: "00000000-0000-0000-0000-0000000000ad",
};
const OM = { a: "10000000-0000-0000-0000-00000000000a", b: "10000000-0000-0000-0000-00000000000b" };

/** Executa como um usuário logado (RLS valendo). */
async function como<T = Record<string, unknown>>(usuario: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', true);`);
    return (await tx.query<T>(sql, params)).rows;
  });
}

beforeAll(async () => {
  await db.exec(`
    create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create table auth.identities (user_id uuid, provider text, identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
  `);
  for (const arq of readdirSync(MIG).sort()) {
    let sql = readFileSync(join(MIG, arq), "utf-8");
    if (arq.includes("agendamento")) sql = sql.slice(sql.indexOf("-- Alerta"));
    await db.exec(sql);
  }
  await db.exec(`
    grant usage on schema public to authenticated;
    grant all on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
    insert into auth.users values ('${U.operadorA}'), ('${U.operadorB}'), ('${U.admin}');
    insert into om (id, nome) values ('${OM.a}', 'OM A'), ('${OM.b}', 'OM B');
    insert into perfil (usuario_id, om_id, papel, nome) values
      ('${U.operadorA}', '${OM.a}', 'operador', 'Op A'),
      ('${U.operadorB}', '${OM.b}', 'operador', 'Op B'), ('${U.admin}', null, 'admin', 'Admin');
  `);
}, 60_000);

describe("dados iniciais", () => {
  it("tem IPCA e IPCA-E desde out/2000 e as 17 rubricas padrão", async () => {
    const r = await db.query<{ serie: string; n: number; ini: string }>(
      "select serie, count(*)::int n, min(ano*100+mes)::text ini from indice_mensal group by serie order by serie");
    expect(r.rows).toEqual([{ serie: "IPCA", n: 312, ini: "200010" }, { serie: "IPCA-E", n: 312, ini: "200010" }]);
    expect((await db.query("select * from rubrica_padrao")).rows).toHaveLength(17);
  });

  it("a série composta (regra de vigência) é exatamente a série da planilha original", async () => {
    const planilha = (JSON.parse(readFileSync(join(GOLDEN, "indices-planilha.json"), "utf-8")) as IndiceMensal[])
      .filter((i) => i.percentual !== null);
    const r = await db.query<{ ano: number; mes: number; percentual: string }>("select ano, mes, percentual from indice_composto order by ano, mes");
    expect(r.rows.map((x) => ({ ano: x.ano, mes: x.mes, percentual: Number(x.percentual) }))).toEqual(planilha);
  });

  it("o motor alimentado pelo banco dá o mesmo resultado que alimentado pela planilha", async () => {
    const r = await db.query<{ ano: number; mes: number; percentual: string }>("select ano, mes, percentual from indice_composto");
    const doBanco: IndiceMensal[] = r.rows.map((x) => ({ ano: x.ano, mes: x.mes, percentual: Number(x.percentual) }));
    // meses futuros sem índice continuam na tabela do motor (fator 1)
    for (let a = 2026; a <= 2028; a++) for (let m = 1; m <= 12; m++)
      if (!doBanco.some((i) => i.ano === a && i.mes === m)) doBanco.push({ ano: a, mes: m, percentual: null });
    const planilha = JSON.parse(readFileSync(join(GOLDEN, "indices-planilha.json"), "utf-8")) as IndiceMensal[];
    for (const nome of ["c02_varios_anos", "c04_completo"]) {
      const caso = JSON.parse(readFileSync(join(GOLDEN, `${nome}.entrada.json`), "utf-8")) as EntradaCalculo;
      const viaBanco = calcular({ ...caso, indices: doBanco });
      const viaPlanilha = calcular({ ...caso, indices: planilha });
      expect(viaBanco.cpex).toEqual(viaPlanilha.cpex);
      expect(viaBanco.recapitulacao).toEqual(viaPlanilha.recapitulacao);
    }
    // c02 não é afetado por nenhum erro da planilha na Recapitulação: bate com o Excel
    const c02 = JSON.parse(readFileSync(join(GOLDEN, "c02_varios_anos.entrada.json"), "utf-8")) as EntradaCalculo;
    const g02 = JSON.parse(readFileSync(join(GOLDEN, "c02_varios_anos.json"), "utf-8"));
    expect(calcular({ ...c02, indices: doBanco }).recapitulacao.saldo).toBe(g02["Solicitação Recapitulação"]["F43"]);
  });
});

describe("acesso (RLS): Admin e Operador veem todos os processos", () => {
  beforeAll(async () => {
    await como(U.operadorA, `insert into militar (id, om_id, nome) values ('20000000-0000-0000-0000-00000000000a', '${OM.a}', 'Militar A')`);
    await como(U.operadorB, `insert into militar (id, om_id, nome) values ('20000000-0000-0000-0000-00000000000b', '${OM.b}', 'Militar B')`);
    await como(U.operadorA, `insert into processo (id, om_id, militar_id, numero) values
      ('30000000-0000-0000-0000-00000000000a', '${OM.a}', '20000000-0000-0000-0000-00000000000a', '001/2026')`);
  });

  it("operadores de OMs diferentes e o admin veem todos os militares e processos", async () => {
    for (const u of [U.operadorA, U.operadorB, U.admin]) {
      expect((await como<{ nome: string }>(u, "select nome from militar order by nome")).map((r) => r.nome)).toEqual(["Militar A", "Militar B"]);
      expect(await como(u, "select numero from processo")).toEqual([{ numero: "001/2026" }]);
    }
  });

  it("só o criador e o admin editam o processo; outro operador só consulta", async () => {
    const P = "30000000-0000-0000-0000-00000000000a";
    expect(await como(U.operadorB, `update processo set numero = '002/2026' where id = '${P}' returning numero`)).toEqual([]);
    expect(await como(U.operadorB, `update militar set nome = 'mudou' where id = '20000000-0000-0000-0000-00000000000a' returning id`)).toEqual([]);
    await expect(como(U.operadorB, `insert into lancamento (processo_id, tipo, ano, mes, posicao, valor) values ('${P}', 'devido', 2019, 1, 1, 1)`))
      .rejects.toThrow(/row-level security/);
    expect(await como(U.operadorB, `update processo_rubrica set codigo = 'X' where processo_id = '${P}' returning posicao`)).toEqual([]);
    expect(await como(U.operadorA, `update processo set numero = '002/2026' where id = '${P}' returning numero`)).toEqual([{ numero: "002/2026" }]);
    expect(await como(U.admin, `update processo set numero = '001/2026' where id = '${P}' returning numero`)).toEqual([{ numero: "001/2026" }]);
    // o criador não passa o processo para outro operador
    await expect(como(U.operadorA, `update processo set criado_por = '${U.operadorB}' where id = '${P}'`)).rejects.toThrow(/row-level security/);
  });

  it("usuário sem perfil ou desativado não vê nada", async () => {
    await db.exec("insert into auth.users values ('00000000-0000-0000-0000-0000000000ee')");
    expect(await como("00000000-0000-0000-0000-0000000000ee", "select * from processo")).toEqual([]);
    await db.exec(`update perfil set ativo = false where usuario_id = '${U.operadorB}'`);
    expect(await como(U.operadorB, "select * from processo")).toEqual([]);
    await db.exec(`update perfil set ativo = true where usuario_id = '${U.operadorB}'`);
  });

  it("não deixa abrir processo com militar de outra OM", async () => {
    await expect(como(U.operadorA, `insert into processo (om_id, militar_id) values ('${OM.a}', '20000000-0000-0000-0000-00000000000b')`))
      .rejects.toThrow(/militar não pertence/);
  });

  it("só o admin altera a OM; operador só lê", async () => {
    expect((await como(U.operadorA, "select nome from om order by nome")).map((r) => r.nome)).toEqual(["OM A", "OM B"]);
    expect(await como(U.operadorA, "update om set nome = 'mudou' returning id")).toEqual([]);
    expect(await como(U.admin, `update om set cidade_uf = 'Natal-RN' where id = '${OM.a}' returning cidade_uf`)).toEqual([{ cidade_uf: "Natal-RN" }]);
  });

  it("todos leem os índices; usuário comum não altera", async () => {
    expect((await como(U.operadorB, "select count(*)::int n from indice_mensal"))[0]).toEqual({ n: 624 });
    expect(await como(U.operadorA, "update indice_mensal set percentual = 9 where ano = 2020 returning ano")).toEqual([]);
  });
});

describe("operadores", () => {
  it("o papel gestor não existe mais", async () => {
    await db.exec("insert into auth.users values ('00000000-0000-0000-0000-0000000000c2')");
    await expect(db.exec(`insert into perfil (usuario_id, om_id, papel, nome) values ('00000000-0000-0000-0000-0000000000c2', '${OM.a}', 'gestor', 'X')`))
      .rejects.toThrow(/perfil_papel_valido/);
  });

  it("só o admin cadastra operadores; operador não cria nem promove ninguém", async () => {
    await db.exec("insert into auth.users values ('00000000-0000-0000-0000-0000000000c1')");
    await expect(como(U.operadorA, `insert into perfil (usuario_id, om_id, papel, nome, cpf) values ('00000000-0000-0000-0000-0000000000c1', '${OM.a}', 'operador', 'Novo', '52998224725')`))
      .rejects.toThrow(/row-level security/);
    await como(U.admin, `insert into perfil (usuario_id, om_id, papel, nome, cpf) values ('00000000-0000-0000-0000-0000000000c1', '${OM.a}', 'operador', 'Novo', '52998224725')`);
    expect(await como(U.operadorA, `update perfil set papel = 'admin' where usuario_id = '${U.operadorA}' returning papel`)).toEqual([]);
  });

  it("CPF é único entre os operadores não excluídos", async () => {
    await db.exec("insert into auth.users values ('00000000-0000-0000-0000-0000000000c3')");
    const inserir = () => como(U.admin, `insert into perfil (usuario_id, om_id, papel, nome, cpf) values ('00000000-0000-0000-0000-0000000000c3', '${OM.a}', 'operador', 'Outro', '52998224725')`);
    await expect(inserir()).rejects.toThrow(/perfil_cpf_unico/);
    await como(U.admin, "update perfil set excluido_em = now(), ativo = false where usuario_id = '00000000-0000-0000-0000-0000000000c1'");
    await inserir();
  });

  it("operador vê só o próprio perfil; admin vê todos", async () => {
    expect((await como<{ nome: string }>(U.operadorA, "select nome from perfil")).map((r) => r.nome)).toEqual(["Op A"]);
    expect((await como(U.admin, "select nome from perfil")).length).toBeGreaterThan(3);
  });

  it("vincular_cpf_ao_login troca o e-mail de login pelo e-mail técnico do CPF; o site não pode chamá-la", async () => {
    await db.exec(`update auth.users set email = 'op.a@om.eb.mil.br' where id = '${U.operadorA}';
      insert into auth.identities values ('${U.operadorA}', 'email', '{"email": "op.a@om.eb.mil.br", "sub": "x"}')`);
    const r = await db.query<{ login: string }>("select vincular_cpf_ao_login('OP.A@om.eb.mil.br', '111.444.777-35') login");
    expect(r.rows[0]!.login).toBe("11144477735@cpf.painel-ea.local");
    expect((await db.query(`select email from auth.users where id = '${U.operadorA}'`)).rows).toEqual([{ email: "11144477735@cpf.painel-ea.local" }]);
    expect((await db.query(`select identity_data->>'email' e, identity_data->>'sub' s from auth.identities`)).rows)
      .toEqual([{ e: "11144477735@cpf.painel-ea.local", s: "x" }]);
    expect((await db.query(`select cpf from perfil where usuario_id = '${U.operadorA}'`)).rows).toEqual([{ cpf: "11144477735" }]);
    await expect(db.query("select vincular_cpf_ao_login('x@y.z', '123')")).rejects.toThrow(/11 dígitos/);
  });

  it("usuário conclui a troca da senha provisória", async () => {
    await db.exec(`update perfil set trocar_senha = true where usuario_id = '${U.operadorA}'`);
    await como(U.operadorA, "select concluir_troca_senha()");
    expect((await db.query<{ t: boolean }>(`select trocar_senha t from perfil where usuario_id = '${U.operadorA}'`)).rows[0]!.t).toBe(false);
  });
});

describe("regras do processo", () => {
  const P = "30000000-0000-0000-0000-00000000000a";

  it("grava lançamento em rascunho e registra na auditoria com a OM", async () => {
    await como(U.operadorA, `insert into lancamento (processo_id, tipo, ano, mes, posicao, valor) values ('${P}', 'devido', 2020, 1, 1, 5500.00)`);
    const aud = await como(U.admin, "select tabela, acao, om_id from auditoria where tabela = 'lancamento'");
    expect(aud).toEqual([{ tabela: "lancamento", acao: "INSERT", om_id: OM.a }]);
    expect(await como(U.operadorA, "select * from auditoria")).toEqual([]); // operador não lê auditoria
  });

  it("depois de emitido, o processo não aceita mudança nos lançamentos", async () => {
    await como(U.operadorA, `update processo set situacao = 'emitido', indice_ate = '2026-09-01' where id = '${P}'`);
    await expect(como(U.operadorA, `update lancamento set valor = 1 where processo_id = '${P}'`)).rejects.toThrow(/não está em rascunho/);
  });

  it("situação dos índices aponta o último mês coletado", async () => {
    const r = await db.query<{ serie: string; ultimo_mes: Date }>("select serie, ultimo_mes from situacao_indices order by serie");
    expect(r.rows.map((x) => [x.serie, x.ultimo_mes.toISOString().slice(0, 7)])).toEqual([["IPCA", "2026-09"], ["IPCA-E", "2026-09"]]);
  });
});

describe("exclusão de processos", () => {
  const M = "20000000-0000-0000-0000-0000000000e1";
  const P1 = "30000000-0000-0000-0000-0000000000e1", P2 = "30000000-0000-0000-0000-0000000000e2";
  beforeAll(async () => {
    await como(U.operadorA, `insert into militar (id, om_id, nome) values ('${M}', '${OM.a}', 'Militar Exclusão')`);
    await como(U.operadorA, `insert into processo (id, om_id, militar_id) values ('${P1}', '${OM.a}', '${M}'), ('${P2}', '${OM.a}', '${M}')`);
    await como(U.operadorA, `insert into lancamento (processo_id, tipo, ano, mes, posicao, valor) values ('${P1}', 'devido', 2020, 1, 1, 10), ('${P2}', 'recebido', 2020, 2, 1, 20)`);
    await como(U.operadorA, `update processo set situacao = 'emitido' where id = '${P2}'`);
  });

  it("operador não exclui processo de outro operador nem militar com processo", async () => {
    expect(await como(U.operadorB, `delete from processo where id = '${P1}' returning id`)).toEqual([]);
    expect(await como(U.operadorB, `delete from militar where id = '${M}' returning id`)).toEqual([]);
    expect((await db.query(`select count(*)::int n from processo where id in ('${P1}', '${P2}')`)).rows).toEqual([{ n: 2 }]);
  });

  it("o criador exclui o próprio processo (com os lançamentos)", async () => {
    const P3 = "30000000-0000-0000-0000-0000000000e3";
    await como(U.operadorA, `insert into processo (id, om_id, militar_id) values ('${P3}', '${OM.a}', '${M}')`);
    await como(U.operadorA, `insert into lancamento (processo_id, tipo, ano, mes, posicao, valor) values ('${P3}', 'devido', 2020, 1, 1, 10)`);
    expect(await como(U.operadorA, `delete from processo where id = '${P3}' returning id`)).toEqual([{ id: P3 }]);
    expect((await db.query(`select count(*)::int n from lancamento where processo_id = '${P3}'`)).rows).toEqual([{ n: 0 }]);
  });

  it("a trava continua: lançamento de processo emitido não muda", async () => {
    await expect(como(U.operadorA, `update lancamento set valor = 1 where processo_id = '${P2}'`)).rejects.toThrow(/não está em rascunho/);
  });

  it("admin exclui processo em rascunho e emitido, com lançamentos (cascata), e o militar sem processos", async () => {
    expect(await como(U.admin, `delete from processo where id = '${P1}' returning id`)).toEqual([{ id: P1 }]);
    expect(await como(U.admin, `delete from processo where id = '${P2}' returning id`)).toEqual([{ id: P2 }]);
    expect((await db.query(`select count(*)::int n from lancamento where processo_id in ('${P1}', '${P2}')`)).rows).toEqual([{ n: 0 }]);
    expect(await como(U.admin, `delete from militar where id = '${M}' returning id`)).toEqual([{ id: M }]);
    const aud = await como<{ acao: string }>(U.admin, `select acao from auditoria where tabela = 'processo' and registro = '${P1}' order by em desc limit 1`);
    expect(aud).toEqual([{ acao: "DELETE" }]); // exclusão fica registrada na auditoria
  });
});
