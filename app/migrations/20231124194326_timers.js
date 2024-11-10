exports.up = function (knex) {
  return knex.schema.createTable("timers", (table) => {
    table.string("id").unique().notNullable();
    table.integer("user_id").notNullable();
    table.foreign("user_id").references("users.id");
    table.string("description", 255).notNullable().defaultTo("No Name");
    table.bigint("start").notNullable().defaultTo(0);
    table.bigint("end").notNullable().defaultTo(0);
    table.bigint("progress").notNullable().defaultTo(0);
    table.bigint("duration").notNullable().defaultTo(0);
    table.boolean("isActive").notNullable();
  });
};
exports.down = function (knex) {
  return knex.schema.dropTable("timers");
};
