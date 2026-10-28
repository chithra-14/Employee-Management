
const express = require("express");
const Attendance = require("../models/Attendance");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Require a valid login token for every attendance endpoint
router.use(authMiddleware);

router.post("/checkin", async (req, res) => {
    try {
        const { employeeId } = req.body;

        const now = new Date();

        const attendance = new Attendance({
            employeeId: employeeId,
            date: now.toISOString().split("T")[0],
            checkIn: now.toLocaleTimeString(),
            status: "Present"
        });

        await attendance.save();

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put("/checkout/:id", async (req, res) => {
    try {
        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({
                error: "Attendance not found"
            });
        }

        attendance.checkOut = new Date().toLocaleTimeString();

        await attendance.save();

        res.json(attendance);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

router.get("/", async (req, res) => {
    try {
        const attendance = await Attendance.find()
            .populate("employeeId");

        console.log("First populated attendance:", attendance[0]);

        res.json(attendance);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;
