import requests

url = 'http://localhost:3000'

resp = requests.get(f'{url}', timeout=5)

print(resp.text)    