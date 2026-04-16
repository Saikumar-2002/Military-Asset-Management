const { getUserByUsername, getUserById } = require("../db");

function findByUsername(username) {
  return getUserByUsername(username);
}

function findById(id) {
  return getUserById(id);
}

module.exports = {
  findByUsername,
  findById
};

