const express = require("express");
const Employee = require("../models/Employee");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const employee = new Employee(req.body);
        await employee.save();
        res.json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const employees = await Employee.find();
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;