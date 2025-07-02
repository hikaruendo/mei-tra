from PIL import Image, ImageDraw

# Create icon.png (1024x1024)
icon = Image.new('RGBA', (1024, 1024), (27, 94, 32, 255))  # Green background
draw = ImageDraw.Draw(icon)
# Simple card design
draw.rectangle([256, 256, 768, 768], fill=(255, 255, 255, 255))
draw.text((450, 480), "M", fill=(27, 94, 32, 255))
icon.save('icon.png')

# Create adaptive-icon.png (1024x1024)
adaptive_icon = Image.new('RGBA', (1024, 1024), (27, 94, 32, 255))
draw = ImageDraw.Draw(adaptive_icon)
draw.rectangle([312, 312, 712, 712], fill=(255, 255, 255, 255))
draw.text((480, 480), "M", fill=(27, 94, 32, 255))
adaptive_icon.save('adaptive-icon.png')

# Create splash-icon.png (1242x2436)
splash = Image.new('RGBA', (1242, 2436), (27, 94, 32, 255))
draw = ImageDraw.Draw(splash)
draw.rectangle([421, 968, 821, 1468], fill=(255, 255, 255, 255))
draw.text((580, 1180), "Mei-Tra", fill=(27, 94, 32, 255))
splash.save('splash-icon.png')

# Create favicon.png (48x48)
favicon = Image.new('RGBA', (48, 48), (27, 94, 32, 255))
draw = ImageDraw.Draw(favicon)
draw.rectangle([12, 12, 36, 36], fill=(255, 255, 255, 255))
draw.text((20, 20), "M", fill=(27, 94, 32, 255))
favicon.save('favicon.png')

print("Icons created successfully\!")
