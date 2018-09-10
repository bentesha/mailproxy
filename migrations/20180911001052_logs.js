
exports.up = function(knex, Promise) {
  return knex.schema.createTable('logs', table => {
    table.string("id").primary();
    table.string('email').notNullable();
    table.datetime("datetime").notNullable();
    table.string("type").notNullable();
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable("logs");
};
