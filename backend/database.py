import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv
import os

load_dotenv()

db_pool = pooling.MySQLConnectionPool(
    pool_name="nogorgoti_pool",
    pool_size=5,
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT")),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)


def get_db_connection():
    return db_pool.get_connection()


def get_db():
    connection = get_db_connection()

    try:
        yield connection
    finally:
        connection.close()


if __name__ == "__main__":
    connection = get_db_connection()

    if connection.is_connected():
        print("MySQL connection successful!")

    connection.close()