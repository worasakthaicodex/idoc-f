# ===== build stage: Maven + JDK 21 =====
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# cache dependencies ก่อน (เร็วขึ้นเวลา build ซ้ำ)
COPY pom.xml .
RUN mvn -q -B -DskipTests dependency:go-offline || true
COPY src ./src
RUN mvn -q -B -DskipTests -Dspotless.check.skip=true clean package

# ===== run stage: JRE 21 เล็ก =====
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Cloud Run ส่ง PORT มาเอง (แอปอ่าน ${PORT:8080} อยู่แล้ว) · จำกัด heap ให้พอดี container
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC"
EXPOSE 8080
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
