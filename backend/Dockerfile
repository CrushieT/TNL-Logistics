# Stage 1: Maven Build
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and package the JAR
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal Runtime JRE
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copy built artifact from build stage
COPY --from=build /app/target/logistics-0.0.1-SNAPSHOT.jar app.jar

# Expose backend port
EXPOSE 8080

# Run JVM with performance configurations
ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=prod", "app.jar"]
