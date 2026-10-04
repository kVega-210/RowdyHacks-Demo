# IF-01 container build: compiles the server and serves everything from one image.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app/server
COPY server/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY server/src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/server/target/heist-server.jar server/target/heist-server.jar
COPY client client
COPY shared shared
COPY content content
COPY dev dev
COPY server/db server/db
ENV HEIST_ROOT=/app PORT=7070
EXPOSE 7070
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:7070/health || exit 1
CMD ["java", "-XX:MaxRAMPercentage=70", "-jar", "server/target/heist-server.jar"]
