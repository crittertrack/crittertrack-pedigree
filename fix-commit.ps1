#!/usr/bin/env pwsh
Set-Location "c:\Projects\crittertrack-pedigree"
git add routes/animalRoutes.js
git commit -m "fix: remove extra closing brace in offspring route

Fixed syntax error in GET /animals/:id_public/offspring caused by duplicate
closing brace in the litter record fetching logic."
git push origin main
