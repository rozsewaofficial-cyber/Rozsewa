require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('Connected to MongoDB');
        
        // Connect to Employee and User collections manually
        const db = mongoose.connection.db;
        
        const employeesCollection = db.collection('employees');
        const usersCollection = db.collection('users');

        // Find all employees
        const employees = await employeesCollection.find({}).toArray();
        console.log(`Found ${employees.length} employees to delete.`);

        let usersDeleted = 0;
        for (const emp of employees) {
            if (emp.userId) {
                const res = await usersCollection.deleteOne({ _id: emp.userId });
                if (res.deletedCount > 0) usersDeleted++;
            }
        }

        // Delete all employees
        const empRes = await employeesCollection.deleteMany({});
        
        console.log(`Successfully deleted ${empRes.deletedCount} employee records and ${usersDeleted} linked user records.`);
        
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
