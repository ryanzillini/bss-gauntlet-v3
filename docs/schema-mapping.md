# Database Schema to TMF SID Mapping

This page allows you to create mappings between your database schemas and TMF SID (Shared Information Data Model).

## Overview

The Schema Mapping page provides a way to:

1. Upload your database schema in JSON format
2. Select TMF SID classes and attributes from the TMF API documentation
3. Create mappings between your database columns and TMF attributes
4. Save and manage these mappings for later use

## How to Use

### 1. Upload Your Database Schema

The first step is to upload your database schema in JSON format. The schema should follow this structure:

```json
{
  "name": "Your Schema Name",
  "description": "Optional description",
  "tables": [
    {
      "name": "table_name",
      "description": "Table description",
      "columns": [
        {
          "name": "column_name",
          "type": "data_type",
          "description": "Column description",
          "isPrimaryKey": true|false,
          "isForeignKey": true|false,
          "references": {
            "table": "referenced_table",
            "column": "referenced_column"
          }
        },
        // More columns...
      ]
    },
    // More tables...
  ]
}
```

You can download a [sample template](/examples/database-schema-template.json) to get started.

### 2. Create Mappings

Once your schema is uploaded:

1. Select your database schema from the dropdown
2. Choose a table and column from your schema
3. Select a TMF SID class and attribute to map to
4. Click "Add Mapping" to create the mapping
5. Continue adding mappings as needed
6. Click "Save Mappings" when you're done

### 3. Manage Saved Mappings

The page displays all your saved mappings at the bottom. You can:

- View mapping details
- Delete mappings you no longer need

## Benefits

Creating these mappings provides several benefits:

- **Standardization**: Map your proprietary database structure to industry-standard TMF models
- **Integration**: Simplify integration with TMF-compliant systems
- **Documentation**: Create clear documentation of how your data maps to TMF standards
- **API Transformation**: Use these mappings to transform data for TMF API calls

## Notes

- The TMF SID classes are loaded from the TMF API documentation
- Mappings are stored in the database and associated with your user account
- You can create multiple mappings for different schemas or TMF classes 