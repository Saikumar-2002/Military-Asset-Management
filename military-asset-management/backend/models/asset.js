const { listAssets } = require("../db");

function getAllAssets() {
  return listAssets();
}

module.exports = {
  getAllAssets
};

