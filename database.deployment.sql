-- ================================================================
-- MuniWeb Deployment Database (Sanitized)
-- Generated: 2026-04-15 17:09:10
-- Notes:
--  1) Operational data rows were removed from this file.
--  2) This file is intended for new customer deployments.
-- ================================================================
-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- ------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `level` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `biometrics`
--

DROP TABLE IF EXISTS `biometrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `biometrics` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `ip_address` varchar(50) NOT NULL,
  `port` varchar(50) NOT NULL,
  `active` tinyint(3) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ip_address` (`ip_address`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `biometrics`
--

LOCK TABLES `biometrics` WRITE;
/*!40000 ALTER TABLE `biometrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `biometrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dtrs`
--

DROP TABLE IF EXISTS `dtrs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dtrs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int(10) unsigned NOT NULL,
  `date` date NOT NULL,
  `am_in` time DEFAULT NULL,
  `am_out` time DEFAULT NULL,
  `pm_in` time DEFAULT NULL,
  `pm_out` time DEFAULT NULL,
  `locked` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_employee_date` (`employee_id`,`date`),
  KEY `FK_dtrs_employees` (`employee_id`),
  KEY `idx_dtrs_employee_date` (`employee_id`,`date`),
  CONSTRAINT `FK_dtrs_employees` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dtrs`
--

LOCK TABLES `dtrs` WRITE;
/*!40000 ALTER TABLE `dtrs` DISABLE KEYS */;
/*!40000 ALTER TABLE `dtrs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_schedules`
--

DROP TABLE IF EXISTS `employee_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(10) unsigned NOT NULL,
  `date` date NOT NULL,
  `am_in` time DEFAULT '08:00:00',
  `am_out` time DEFAULT '12:00:00',
  `pm_in` time DEFAULT '13:00:00',
  `pm_out` time DEFAULT '17:00:00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_emp_date` (`employee_id`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_schedules`
--

LOCK TABLES `employee_schedules` WRITE;
/*!40000 ALTER TABLE `employee_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `office` varchar(100) NOT NULL,
  `registered` tinyint(4) NOT NULL DEFAULT 0,
  `am_in` time NOT NULL,
  `am_out` time DEFAULT NULL,
  `pm_in` time DEFAULT NULL,
  `pm_out` time NOT NULL,
  `noter` tinyint(4) DEFAULT 0,
  `signatory` varchar(100) DEFAULT NULL,
  `regular` tinyint(4) NOT NULL DEFAULT 0,
  `is_registered` tinyint(1) DEFAULT 0,
  `is_noter` tinyint(1) DEFAULT 0,
  `is_regular` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `imports`
--

DROP TABLE IF EXISTS `imports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `imports` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_imports_employee_created` (`employee_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `imports`
--

LOCK TABLES `imports` WRITE;
/*!40000 ALTER TABLE `imports` DISABLE KEYS */;
/*!40000 ALTER TABLE `imports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logs`
--

DROP TABLE IF EXISTS `logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int(10) unsigned NOT NULL,
  `action` varchar(50) NOT NULL,
  `category` varchar(50) NOT NULL,
  `original` text DEFAULT NULL,
  `updated` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `FK_logs_admins` (`admin_id`),
  CONSTRAINT `FK_logs_admins` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logs`
--

LOCK TABLES `logs` WRITE;
/*!40000 ALTER TABLE `logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `noters`
--

DROP TABLE IF EXISTS `noters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `noters` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `office` varchar(100) NOT NULL,
  `signatory` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `noters`
--

LOCK TABLES `noters` WRITE;
/*!40000 ALTER TABLE `noters` DISABLE KEYS */;
/*!40000 ALTER TABLE `noters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `officials`
--

DROP TABLE IF EXISTS `officials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `officials` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `signatory` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `officials`
--

LOCK TABLES `officials` WRITE;
/*!40000 ALTER TABLE `officials` DISABLE KEYS */;
/*!40000 ALTER TABLE `officials` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-15 16:33:44


-- Default deployment admin account
-- Username: admin
-- Temporary password (plain): ChangeMe123!
-- IMPORTANT: Change this password immediately after first login.
INSERT INTO dmins (username, password, 
ame, level)
VALUES ('admin', '$2b$10$NFqLlKojAtopP.0K5iHty.CyopICENpu0rUQFtBUFhDzhEkjh.nIi', 'System Administrator', 3);
-- End of sanitized deployment SQL

