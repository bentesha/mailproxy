
exports.up = function(knex, Promise) {
  return knex.schema.createTable('sent_emails', table => {
    table.string('id').primary();
    table.string("email").notNullable();
    table.datetime('datetime').notNullable();
  })
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('sent_emails');
};
