const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true
    },
    date: {
        type: String,
        required: true
    },
    checkIn: String,
    checkOut: String,
    status: {
        type: String,
        default: "Present"
    }
});

module.exports = mongoose.model("Attendance", attendanceSchema);