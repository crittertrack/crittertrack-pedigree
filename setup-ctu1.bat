@echo off
echo ==========================================
echo CTU1 Admin Setup Script
echo ==========================================
echo.
echo 1. Connecting to MongoDB...
echo.
mongosh "mongodb+srv://crittertrack_app_user_v2:xSmRuas3OVAZGUZD@crittertrack.artyose.mongodb.net/crittertrackdb" --quiet <<'EOF'
var ctu1 = db.users.findOne({ email: /ctu1/i });

if (ctu1) {
    print("Found CTU1 account:");
    print("  ID: " + ctu1._id);
    print("  Email: " + ctu1.email);
    print("  Role: " + ctu1.role);
    print("  adminPassword set: " + (ctu1.adminPassword ? "YES" : "NO"));
    
    // Update role to admin if not already
    if (ctu1.role !== "admin") {
        db.users.updateOne(
            { _id: ctu1._id },
            { $set: { role: "admin" } }
        );
        print("  ✅ Role updated to: admin");
    }
    
    // Set admin password if not already set
    if (!ctu1.adminPassword) {
        var password = "CTU1AdminPass123";
        var salt = Crypto.randomBytes(16).toString('hex');
        var hash = Crypto.createHash('sha256').update(password + salt).digest('hex');
        
        db.users.updateOne(
            { _id: ctu1._id },
            { $set: { adminPassword: hash } }
        );
        print("  ✅ adminPassword set");
        print("  🔐 Password: " + password);
    } else {
        print("  ℹ️ adminPassword already exists");
    }
    
    print("\n=== CTU1 Ready for Moderation ===");
    print("Role: admin");
    print("adminPassword: set");
} else {
    print("❌ CTU1 not found in database");
    print("Creating new CTU1 account...");
    db.users.insertOne({
        email: "ctu1@crittertrack.net",
        personalName: "CTU1",
        role: "admin",
        adminPassword: Crypto.createHash('sha256').update("TempPass123" + Crypto.randomBytes(16).toString('hex')).digest('hex'),
        accountStatus: "normal"
    });
    print("  ✅ New CTU1 account created");
    print("  🔐 Default password: TempPass123");
}

print("\nSetup complete! CTU1 can now use moderation authentication.");
EOF
echo.
echo ==========================================
echo Setup complete!
echo ==========================================
pause