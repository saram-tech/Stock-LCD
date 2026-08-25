# ==========================================
# APPLICATION BACKEND STOCK LCD (SANS WIFI)
# ==========================================

import sqlite3
import json

DB_NAME = "stock_lcd.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Table Stock
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT UNIQUE NOT NULL,
            designation TEXT NOT NULL,
            quantite INTEGER NOT NULL DEFAULT 0,
            prix_unitaire REAL NOT NULL DEFAULT 0.0
        )
    ''')
    
    # Table Ventes Physiques (WiFi exclu)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ventes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produit_id INTEGER,
            quantite INTEGER NOT NULL,
            prix_total REAL NOT NULL,
            date_vente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (produit_id) REFERENCES stock (id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("Base de données initialisée avec succès (sans tables WiFi).")

def ajouter_produit(ref, designation, quantite, prix):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO stock (reference, designation, quantite, prix_unitaire)
            VALUES (?, ?, ?, ?)
        ''', (ref, designation, quantite, prix))
        conn.commit()
        print(f"Produit '{designation}' ajouté.")
    except sqlite3.IntegrityError:
        print(f"Erreur: La référence '{ref}' existe déjà.")
    finally:
        conn.close()

def enregistrer_vente(produit_id, quantite):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Vérification du stock
    cursor.execute("SELECT quantite, prix_unitaire, designation FROM stock WHERE id = ?", (produit_id,))
    prod = cursor.fetchone()
    
    if not prod:
        print("Erreur: Produit non trouvé.")
        conn.close()
        return
        
    stock_actuel, prix_unitaire, designation = prod
    
    if stock_actuel < quantite:
        print(f"Erreur: Stock insuffisant pour '{designation}'. Disponible: {stock_actuel}")
        conn.close()
        return
        
    # Mise à jour du stock et enregistrement de la vente
    nouveau_stock = stock_actuel - quantite
    prix_total = quantite * prix_unitaire
    
    cursor.execute("UPDATE stock SET quantite = ? WHERE id = ?", (nouveau_stock, produit_id))
    cursor.execute("INSERT INTO ventes (produit_id, quantite, prix_total) VALUES (?, ?, ?)", 
                   (produit_id, quantite, prix_total))
    
    conn.commit()
    conn.close()
    print(f"Vente de {quantite}x {designation} enregistrée avec succès. Total: {prix_total:.2f} €")

def obtenir_etat_stock():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT id, reference, designation, quantite, prix_unitaire FROM stock")
    rows = cursor.fetchall()
    conn.close()
    return rows

if __name__ == "__main__":
    init_db()
    
    # Exemples de tests
    ajouter_produit("LCD-1602", "Écran LCD 16x2 Bleu", 50, 12.50)
    ajouter_produit("LCD-2004", "Écran LCD 20x4 Vert", 30, 18.00)
    
    print("\n--- État actuel du stock ---")
    for item in obtenir_etat_stock():
        print(item)
