# TNL Logistics Backend Service

Modular monolith backend API built using **Spring Boot 3.4.2** and **Java 21**.

## Prerequisites

- **Java 21** (Eclipse Temurin JDK 21 recommended)
- **Maven 3.9+**
- **MySQL 8.0** database running locally or via Docker

## Getting Started

### Local Development

1. Ensure MySQL is running on `localhost:3306` and database `tnl_dev` exists:
   ```sql
   CREATE DATABASE tnl_dev;
   ```
2. Navigate to this backend folder:
   ```bash
   cd backend
   ```
3. Run the Spring Boot application using Maven:
   ```bash
   mvn spring-boot:run
   ```
   *The application defaults to the `dev` profile. Flyway will automatically run database schema migrations on startup.*

### Running Tests

Execute unit and integration tests:
```bash
mvn test
```

### Packaging the Application

Compile and package the codebase into a production-ready runnable fat JAR file:
```bash
mvn clean package
```
The output JAR is compiled to `target/logistics-0.0.1-SNAPSHOT.jar`.

### Swagger UI API Documentation

Once the application is running, the OpenAPI swagger documentation is available at:
- **Swagger UI:** [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **JSON API Docs:** [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)

### Building Docker Image

Build the container image using the multi-stage `Dockerfile`:
```bash
docker build -t tnl-backend .
```
Run the built container locally:
```bash
docker run -p 8080:8080 -e SPRING_DATASOURCE_URL=jdbc:mysql://host.docker.internal:3306/tnl_dev -e SPRING_DATASOURCE_USERNAME=root -e SPRING_DATASOURCE_PASSWORD=root tnl-backend
```
