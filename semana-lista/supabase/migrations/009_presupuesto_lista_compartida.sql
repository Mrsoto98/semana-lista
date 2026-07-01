alter table listas_compartidas
  add column if not exists presupuesto numeric(10,2) default null;
