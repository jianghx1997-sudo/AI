const { dbAsync } = require('../database');
const { analyzeWardrobe } = require('../services/wardrobeAnalysisService');

async function getCategoryStats(req, res) {
  try {
    const stats = await dbAsync.getCategoryStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getWardrobeAnalysis(req, res) {
  try {
    const clothes = await dbAsync.getAllClothes({ userId: req.user.id });
    res.json({ success: true, data: analyzeWardrobe(clothes) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getCategoryStats,
  getWardrobeAnalysis
};
